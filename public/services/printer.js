/**
 * Printer Service for Flight Deck
 * Handles Bluetooth printer connection and badge printing via Web Bluetooth API
 * Supports Brother QL-820NWB and similar ESC/P printers
 */

class PrinterService {
  constructor() {
    this.connectedPrinter = null;
    this.characteristic = null;
    this.isSupported = 'bluetooth' in navigator;
    this.browserInfo = this.detectBrowser();
  }

  /**
   * Detect browser type
   */
  detectBrowser() {
    const ua = navigator.userAgent;
    const isChrome = /Chrome/.test(ua) && /Google Inc/.test(navigator.vendor);
    const isEdge = /Edg/.test(ua) || /EdgiOS/.test(ua) || /Edge/.test(ua);
    const isOpera = /OPR/.test(ua);
    // Safari check: has Safari in UA but NOT Chrome/Chromium AND NOT Edge
    const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua) && !/Edg/.test(ua) && !/EdgiOS/.test(ua);
    const isFirefox = /Firefox/.test(ua);

    return {
      name: isSafari ? 'Safari' : isEdge ? 'Edge' : isChrome ? 'Chrome' : isOpera ? 'Opera' : isFirefox ? 'Firefox' : 'Unknown',
      isSupported: this.isSupported && (isChrome || isEdge || isOpera),
      isSafari
    };
  }

  /**
   * Check if Web Bluetooth is supported
   */
  checkSupport() {
    if (this.browserInfo.isSafari) {
      throw new Error(
        '⚠️ Safari does not support Web Bluetooth.\n\n' +
        'Please use one of these browsers:\n' +
        '• Google Chrome\n' +
        '• Microsoft Edge\n' +
        '• Opera\n\n' +
        'You can download Chrome at: https://www.google.com/chrome/'
      );
    }
    
    if (!this.isSupported) {
      throw new Error(
        'Web Bluetooth is not supported in this browser.\n\n' +
        'Please use Chrome, Edge, or Opera for printer connectivity.'
      );
    }
  }

  /**
   * Scan for available Bluetooth printers
   */
  async scanForPrinters() {
    this.checkSupport();

    try {
      // Request Bluetooth device with flexible filters to find Brother printers
      const device = await navigator.bluetooth.requestDevice({
        // Accept all devices, let user choose
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // Brother Printer Service
          '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Generic Serial
        ]
      });

      return device;
    } catch (error) {
      if (error.name === 'NotFoundError') {
        throw new Error('No printers found. Make sure the printer is turned on and in pairing mode.');
      }
      throw error;
    }
  }

  /**
   * Connect to a Bluetooth printer
   */
  async connectToPrinter(device) {
    try {
      console.log('Connecting to printer:', device.name);

      const server = await device.gatt.connect();
      console.log('Connected to GATT server');

      // Try Brother printer service first
      let service;
      try {
        service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      } catch (e) {
        // Fall back to generic serial service
        service = await server.getPrimaryService('49535343-fe7d-4ae5-8fa9-9fafd205e455');
      }

      console.log('Got printer service');

      // Get the characteristic for writing
      const characteristics = await service.getCharacteristics();
      this.characteristic = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse);

      if (!this.characteristic) {
        throw new Error('Could not find writable characteristic on printer');
      }

      this.connectedPrinter = {
        device,
        server,
        service,
        name: device.name,
        id: device.id
      };

      // Save to IndexedDB
      await flightDeckDB.setSetting('activePrinter', {
        name: device.name,
        id: device.id,
        connectedAt: new Date().toISOString()
      });

      console.log('Printer connected successfully:', device.name);
      return this.connectedPrinter;
    } catch (error) {
      console.error('Error connecting to printer:', error);
      throw new Error(`Failed to connect to printer: ${error.message}`);
    }
  }

  /**
   * Disconnect from current printer
   */
  async disconnect() {
    if (this.connectedPrinter?.device?.gatt?.connected) {
      await this.connectedPrinter.device.gatt.disconnect();
    }
    this.connectedPrinter = null;
    this.characteristic = null;
  }

  /**
   * Check if printer is connected
   */
  isConnected() {
    return this.connectedPrinter?.device?.gatt?.connected || false;
  }

  /**
   * Get connected printer info
   */
  getConnectedPrinter() {
    return this.connectedPrinter;
  }

  /**
   * Send raw data to printer
   */
  async sendToPrinter(data) {
    if (!this.isConnected()) {
      throw new Error('No printer connected. Please connect to a printer first.');
    }

    try {
      const encoder = new TextEncoder();
      const dataArray = encoder.encode(data);
      
      // Split into chunks if needed (some devices have MTU limits)
      const chunkSize = 512;
      for (let i = 0; i < dataArray.length; i += chunkSize) {
        const chunk = dataArray.slice(i, i + chunkSize);
        await this.characteristic.writeValue(chunk);
      }
    } catch (error) {
      console.error('Error sending to printer:', error);
      throw new Error(`Failed to send to printer: ${error.message}`);
    }
  }

  /**
   * Print a badge
   * Generates ESC/P commands for Brother QL-820NWB
   */
  async printBadge(attendee, options = {}) {
    const { testPrint = false } = options;

    // ESC/P commands for Brother QL-820NWB (62mm label)
    const ESC = '\x1B';
    const commands = [
      ESC + '@',              // Initialize printer
      ESC + 'iL',             // Set label mode
      ESC + 'iK\x01',         // Set auto cut
      ESC + 'iM\x40',         // Set print mode (high quality)
      ESC + 'iq1',            // Set cut interval to 1
    ];

    // Add text content
    const lines = [
      `${attendee.firstName} ${attendee.lastName}`,
      attendee.combinedCourseName || '',
      `Badge: ${attendee.badgeNumber || 'N/A'}`,
    ];

    // Add text commands (simplified - you may need to adjust for your printer)
    lines.forEach((line, index) => {
      if (line) {
        commands.push(
          ESC + 'iY' + String.fromCharCode(index * 100), // Set Y position
          line,
          '\n'
        );
      }
    });

    // Print command
    commands.push(
      '\x0C',                 // Form feed (print)
    );

    const printData = commands.join('');

    try {
      await this.sendToPrinter(printData);
      console.log(`Badge ${testPrint ? '(test) ' : ''}printed for:`, attendee.firstName, attendee.lastName);
      return true;
    } catch (error) {
      console.error('Print failed:', error);
      throw error;
    }
  }

  /**
   * Test printer connection
   */
  async testPrint() {
    const testData = [
      '\x1B@',               // Initialize
      'Flight Deck Test Print\n',
      new Date().toLocaleString(),
      '\n',
      '\x0C',                // Form feed
    ].join('');

    await this.sendToPrinter(testData);
  }

  /**
   * Load saved printer from IndexedDB
   */
  async loadSavedPrinter() {
    const saved = await flightDeckDB.getSetting('activePrinter');
    return saved;
  }
}

// Export singleton instance
const printerService = new PrinterService();
