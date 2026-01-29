/**
 * Flight Deck Printer Bridge
 * Local HTTP server that connects to Brother QL-820NWB via classic Bluetooth
 * Receives print jobs from the web app and forwards to the printer
 */

const express = require('express');
const cors = require('cors');
const { SerialPort } = require('serialport');

const app = express();
const PORT = 8765;

// Store connected printer
let printerPort = null;
let printerInfo = null;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    printer: printerInfo ? {
      connected: true,
      name: printerInfo.name,
      path: printerInfo.path
    } : {
      connected: false
    }
  });
});

/**
 * List available serial ports (Bluetooth SPP shows up as serial port on Mac)
 */
app.get('/printers', async (req, res) => {
  try {
    const ports = await SerialPort.list();
    
    // Filter for Brother printers or Bluetooth serial ports
    const printers = ports.filter(port => 
      port.path.includes('Bluetooth') || 
      port.path.includes('tty.') ||
      (port.manufacturer && port.manufacturer.includes('Brother'))
    ).map(port => ({
      name: port.friendlyName || port.path,
      path: port.path,
      manufacturer: port.manufacturer,
      serialNumber: port.serialNumber
    }));

    res.json({ printers });
  } catch (error) {
    console.error('Error listing printers:', error);
    res.status(500).json({ error: 'Failed to list printers' });
  }
});

/**
 * Connect to a specific printer
 */
app.post('/connect', async (req, res) => {
  const { printerPath } = req.body;

  if (!printerPath) {
    return res.status(400).json({ error: 'printerPath is required' });
  }

  try {
    // Close existing connection if any
    if (printerPort && printerPort.isOpen) {
      printerPort.close();
    }

    // Open connection to printer
    printerPort = new SerialPort({
      path: printerPath,
      baudRate: 9600, // Brother QL-820NWB typically uses 9600
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      flowControl: false
    });

    printerPort.on('open', () => {
      console.log('✓ Connected to printer:', printerPath);
      printerInfo = {
        name: printerPath,
        path: printerPath,
        connectedAt: new Date().toISOString()
      };
    });

    printerPort.on('error', (err) => {
      console.error('Printer error:', err);
      printerInfo = null;
    });

    printerPort.on('close', () => {
      console.log('Printer connection closed');
      printerInfo = null;
    });

    // Wait for connection to establish
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 5000);

      printerPort.once('open', () => {
        clearTimeout(timeout);
        resolve();
      });

      printerPort.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    res.json({ 
      success: true, 
      printer: printerInfo 
    });
  } catch (error) {
    console.error('Error connecting to printer:', error);
    res.status(500).json({ 
      error: 'Failed to connect to printer',
      message: error.message 
    });
  }
});

/**
 * Disconnect from printer
 */
app.post('/disconnect', (req, res) => {
  if (printerPort && printerPort.isOpen) {
    printerPort.close();
    printerInfo = null;
    res.json({ success: true });
  } else {
    res.json({ success: true, message: 'No printer connected' });
  }
});

/**
 * Print a badge
 */
app.post('/print', async (req, res) => {
  if (!printerPort || !printerPort.isOpen) {
    return res.status(400).json({ 
      error: 'Printer not connected. Please connect to a printer first.' 
    });
  }

  const { name, company, role, template } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    // Generate ESC/P commands for Brother QL-820NWB
    const commands = generatePrintCommands({ name, company, role, template });
    
    // Send to printer
    await new Promise((resolve, reject) => {
      printerPort.write(Buffer.from(commands), (err) => {
        if (err) reject(err);
        else {
          printerPort.drain((drainErr) => {
            if (drainErr) reject(drainErr);
            else resolve();
          });
        }
      });
    });

    console.log('✓ Print job sent successfully');
    res.json({ success: true });
  } catch (error) {
    console.error('Error printing:', error);
    res.status(500).json({ 
      error: 'Failed to print',
      message: error.message 
    });
  }
});

/**
 * Generate ESC/P commands for Brother QL-820NWB
 * This is a simplified version - you'll need to adjust based on your label size
 */
function generatePrintCommands({ name, company, role, template }) {
  const ESC = 0x1B;
  const commands = [];

  // Initialize printer
  commands.push(ESC, 0x40); // ESC @ - Initialize

  // Set label size (adjust for your label - this is for 62mm tape)
  commands.push(ESC, 0x69, 0x7A, 0x00, 0x3E, 0x00, 0x00, 0x00, 0x00, 0x00);

  // Set print quality
  commands.push(ESC, 0x69, 0x4B, 0x08); // High quality

  // Add text commands
  // Name (larger font)
  commands.push(ESC, 0x69, 0x53); // Set character size
  const nameBytes = Buffer.from(name.toUpperCase(), 'ascii');
  commands.push(...nameBytes);
  commands.push(0x0A); // Line feed

  // Company
  if (company) {
    const companyBytes = Buffer.from(company, 'ascii');
    commands.push(...companyBytes);
    commands.push(0x0A);
  }

  // Role
  if (role) {
    const roleBytes = Buffer.from(role, 'ascii');
    commands.push(...roleBytes);
    commands.push(0x0A);
  }

  // Print command
  commands.push(0x1A); // Print with feeding

  return commands;
}

// Start server
app.listen(PORT, () => {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   Flight Deck Printer Bridge                   ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log('');
  console.log(`✓ Bridge running on http://localhost:${PORT}`);
  console.log('');
  console.log('Instructions:');
  console.log('1. Pair your Brother QL-820NWB via Bluetooth in System Settings');
  console.log('2. Open Flight Deck web app');
  console.log('3. Click "Printer" and select "Use Local Bridge"');
  console.log('4. The web app will connect through this bridge');
  console.log('');
  console.log('Press Ctrl+C to stop');
});
