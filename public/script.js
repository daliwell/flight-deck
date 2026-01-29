/**
 * Flight Deck - Badge Printing Application
 * Main frontend application logic
 */

class FlightDeckApp {
  constructor() {
    this.currentEvent = null;
    this.events = [];
    this.attendees = [];
    this.db = flightDeckDB;
    this.printer = printerService;
    
    this.init();
  }

  async init() {
    console.log('Initializing Flight Deck...');
    
    // Initialize database
    await this.db.init();
    
    // Load user info
    await this.loadUserInfo();
    
    // Load saved printer
    await this.loadPrinter();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Load events
    await this.loadEvents();
  }

  setupEventListeners() {
    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
      window.location.href = '/auth/logout';
    });

    // Printer settings
    document.getElementById('printerSettingsBtn')?.addEventListener('click', () => {
      this.showPrinterModal();
    });

    // Event selection screen
    document.getElementById('refreshEventsBtn')?.addEventListener('click', () => {
      this.loadEvents(true);
    });

    document.getElementById('genreFilter')?.addEventListener('change', () => {
      this.loadEvents();
    });

    // Attendee screen
    document.getElementById('backToEventsBtn')?.addEventListener('click', () => {
      this.showEventSelectionScreen();
    });

    document.getElementById('syncAttendeesBtn')?.addEventListener('click', () => {
      this.syncAttendees();
    });

    document.getElementById('attendeeSearch')?.addEventListener('input', (e) => {
      this.searchAttendees(e.target.value);
    });

    document.getElementById('clearSearchBtn')?.addEventListener('click', () => {
      document.getElementById('attendeeSearch').value = '';
      this.searchAttendees('');
      document.getElementById('clearSearchBtn').style.display = 'none';
    });

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabName = e.currentTarget.dataset.tab;
        this.switchTab(tabName);
      });
    });
  }

  async loadUserInfo() {
    try {
      const response = await fetch('/auth/user');
      if (response.ok) {
        const data = await response.json();
        const user = data.user;
        const userInfoEl = document.getElementById('userInfo');
        if (userInfoEl && user) {
          // Display in format: "Welcome, Name" with email below
          userInfoEl.innerHTML = `👋 Welcome, <strong>${user.name || 'User'}</strong><br><small>${user.email}</small>`;
        }
      }
    } catch (error) {
      console.error('Error loading user info:', error);
      document.getElementById('userInfo').textContent = 'User';
    }
  }

  async loadEvents(forceRefresh = false) {
    const loadingEl = document.getElementById('eventsLoading');
    const errorEl = document.getElementById('eventsError');
    const listEl = document.getElementById('eventsList');

    try {
      loadingEl.style.display = 'block';
      errorEl.style.display = 'none';
      listEl.innerHTML = '';

      // Get filter values
      const genre = document.getElementById('genreFilter')?.value || 'RHEINGOLD';
      const genres = genre === 'ALL' ? ['RHEINGOLD', 'CAMP', 'FLEX_CAMP'] : [genre];
      
      // Default to events from today onwards
      const today = new Date().toISOString().split('T')[0];

      // Fetch courses from API
      // Build query string manually to ensure Edge iOS compatibility
      const queryParams = new URLSearchParams();
      queryParams.append('genres', genres.join(','));
      queryParams.append('startDateFrom', today);
      queryParams.append('pageSize', '100');

      const response = await fetch(`/api/courses?${queryParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch courses');

      const data = await response.json();
      const courses = data.Courses || [];

      // Group courses into events (same city + same week)
      this.events = this.groupCoursesIntoEvents(courses);

      // Save to IndexedDB
      await this.db.saveEvents(this.events);
      
      // Save individual courses with eventId reference
      const coursesWithEventId = courses.map(course => {
        const event = this.events.find(e => 
          e.courses.some(c => c._id === course._id)
        );
        return { ...course, eventId: event?.id };
      });
      await this.db.saveCourses(coursesWithEventId);

      // Display events
      this.displayEvents();

      loadingEl.style.display = 'none';
    } catch (error) {
      console.error('Error loading events:', error);
      loadingEl.style.display = 'none';
      errorEl.style.display = 'block';
      errorEl.textContent = `Error: ${error.message}`;
    }
  }

  groupCoursesIntoEvents(courses) {
    const eventMap = new Map();

    courses.forEach(course => {
      const city = course.location?.city || 'Unknown';
      
      // Parse date - handle various formats
      let startDate;
      if (course.localizedStartDate) {
        const dateStr = course.localizedStartDate;
        
        // Check if it's DD/MM/YYYY format
        if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) {
          // Parse DD/MM/YYYY HH:MM:SS format
          const [datePart] = dateStr.split(' ');
          const [day, month, year] = datePart.split('/');
          startDate = new Date(`${year}-${month}-${day}`);
        } 
        // Check if it's already in YYYY-MM-DD format
        else if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
          startDate = new Date(dateStr + 'T00:00:00');
        } 
        // Try default parsing
        else {
          startDate = new Date(dateStr);
        }
      }
      
      // Skip courses with invalid dates
      if (!startDate || isNaN(startDate.getTime())) {
        console.warn('Skipping course with invalid date:', course);
        return;
      }
      
      // Get week identifier (year + week number)
      const weekStart = new Date(startDate);
      weekStart.setDate(startDate.getDate() - startDate.getDay());
      const weekKey = `${city}-${weekStart.toISOString().split('T')[0]}`;

      if (!eventMap.has(weekKey)) {
        eventMap.set(weekKey, {
          id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          city,
          startDate: weekStart.toISOString().split('T')[0],
          courses: [],
          name: `${city} - Week of ${this.formatDate(weekStart)}`
        });
      }

      eventMap.get(weekKey).courses.push(course);
    });

    // Sort events chronologically (earliest to latest)
    return Array.from(eventMap.values()).sort((a, b) => 
      new Date(a.startDate) - new Date(b.startDate)
    );
  }

  displayEvents() {
    const listEl = document.getElementById('eventsList');
    listEl.innerHTML = '';

    if (this.events.length === 0) {
      listEl.innerHTML = '<p class="no-results">No events found</p>';
      return;
    }

    this.events.forEach(event => {
      const eventCard = document.createElement('div');
      eventCard.className = 'event-card';
      eventCard.onclick = () => this.selectEvent(event);

      const courseNames = event.courses
        .map(c => c.shortName || c.name)
        .join(', ');

      eventCard.innerHTML = `
        <div class="event-header">
          <h3>${event.city}</h3>
          <span class="event-date">${this.formatDateRange(event.courses)}</span>
        </div>
        <div class="event-courses">
          <strong>${event.courses.length} conference${event.courses.length > 1 ? 's' : ''}:</strong>
          <p>${courseNames}</p>
        </div>
        <div class="event-footer">
          <button class="btn btn-primary">Select Event</button>
        </div>
      `;

      listEl.appendChild(eventCard);
    });
  }

  async selectEvent(event) {
    this.currentEvent = event;
    
    // Update header
    document.getElementById('currentEventName').textContent = event.city;
    document.getElementById('currentEventDetails').textContent = 
      `${event.courses.length} conference(s) - ${this.formatDateRange(event.courses)}`;

    // Switch to attendee screen
    this.showAttendeeScreen();

    // Load attendees from IndexedDB first
    await this.loadAttendeesFromDB(event);

    // Then sync from API in background
    this.syncAttendees();
  }

  async loadAttendeesFromDB(event) {
    try {
      const allAttendees = [];
      for (const course of event.courses) {
        const courseAttendees = await this.db.getAttendeesByCourse(course._id);
        // Ensure it's an array before spreading
        if (Array.isArray(courseAttendees)) {
          allAttendees.push(...courseAttendees);
        }
      }
      
      this.attendees = allAttendees;
      this.displayAttendees(this.attendees);
    } catch (error) {
      console.error('Error loading attendees from DB:', error);
    }
  }

  async syncAttendees() {
    if (!this.currentEvent) return;

    const syncStatus = document.getElementById('syncStatus');
    syncStatus.innerHTML = '<div class="sync-message">Syncing attendees...</div>';

    try {
      // Get course IDs
      const courseIds = this.currentEvent.courses.map(c => c._id);

      // Fetch from API
      const response = await fetch('/api/attendees/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseIds })
      });

      if (!response.ok) throw new Error('Failed to fetch attendees');

      const data = await response.json();
      this.attendees = data.attendees || [];

      // Save to IndexedDB
      await this.db.saveAttendees(this.attendees);

      // Display
      this.displayAttendees(this.attendees);

      syncStatus.innerHTML = `<div class="sync-message success">✓ ${this.attendees.length} attendees synced</div>`;
      setTimeout(() => { syncStatus.innerHTML = ''; }, 3000);
    } catch (error) {
      console.error('Error syncing attendees:', error);
      syncStatus.innerHTML = `<div class="sync-message error">Error: ${error.message}</div>`;
    }
  }

  displayAttendees(attendees) {
    const resultsEl = document.getElementById('searchResults');
    resultsEl.innerHTML = '';

    if (attendees.length === 0) {
      resultsEl.innerHTML = '<p class="no-results">No attendees found</p>';
      return;
    }

    const list = document.createElement('div');
    list.className = 'attendee-list';

    attendees.forEach(attendee => {
      const item = document.createElement('div');
      item.className = 'attendee-item';
      item.onclick = () => this.showAttendeeDetails(attendee);

      const firstName = attendee.firstName || '_';
      const lastName = attendee.lastName || '_';
      
      item.innerHTML = `
        <div class="attendee-info">
          <div class="attendee-name">${firstName} ${lastName}</div>
          <div class="attendee-meta">
            ${attendee.swapCardEmail || 'No email'} • 
            ${attendee.badgeNumber ? `Badge: ${attendee.badgeNumber}` : 'No badge'} • 
            ID: ${attendee._id}
            ${attendee.checkInState ? `• ${attendee.checkInState}` : ''}
          </div>
        </div>
        <div class="attendee-actions">
          <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); flightDeckApp.printBadge('${attendee._id}')">
            🖨️ Print
          </button>
        </div>
      `;

      list.appendChild(item);
    });

    resultsEl.appendChild(list);
  }

  async searchAttendees(searchTerm) {
    const clearBtn = document.getElementById('clearSearchBtn');
    clearBtn.style.display = searchTerm ? 'block' : 'none';

    if (!searchTerm) {
      this.displayAttendees(this.attendees);
      return;
    }

    const filtered = await this.db.searchAttendees(searchTerm);
    this.displayAttendees(filtered);
  }

  showAttendeeDetails(attendee) {
    const detailsEl = document.getElementById('attendeeDetails');
    detailsEl.style.display = 'block';

    detailsEl.innerHTML = `
      <div class="attendee-details-card">
        <h3>${attendee.firstName} ${attendee.lastName}</h3>
        <div class="detail-row">
          <span class="label">Badge Number:</span>
          <span class="value">${attendee.badgeNumber || 'N/A'}</span>
        </div>
        <div class="detail-row">
          <span class="label">Type:</span>
          <span class="value">${attendee.type || 'N/A'}</span>
        </div>
        <div class="detail-row">
          <span class="label">Check-in Status:</span>
          <span class="value">${attendee.checkInState || 'Not checked in'}</span>
        </div>
        <div class="detail-row">
          <span class="label">Conference:</span>
          <span class="value">${attendee.combinedCourseName || 'N/A'}</span>
        </div>
        <div class="detail-actions">
          <button class="btn btn-primary btn-large" onclick="flightDeckApp.printBadge('${attendee._id}')">
            🖨️ Print Badge
          </button>
          <button class="btn btn-secondary" onclick="flightDeckApp.closeAttendeeDetails()">
            Close
          </button>
        </div>
      </div>
    `;
  }

  closeAttendeeDetails() {
    document.getElementById('attendeeDetails').style.display = 'none';
  }

  printBadge(attendeeId) {
    const attendee = this.attendees.find(a => a._id === attendeeId);
    if (!attendee) return;

    // Show print modal
    const modal = document.getElementById('printModal');
    modal.style.display = 'flex';

    // Update badge preview
    document.getElementById('badgePreview').innerHTML = `
      <div class="badge-preview-card">
        <h2>${attendee.firstName} ${attendee.lastName}</h2>
        <p>${attendee.combinedCourseName || ''}</p>
        <p class="badge-number">${attendee.badgeNumber || 'No Badge Number'}</p>
      </div>
    `;

    // Setup print button
    document.getElementById('confirmPrintBtn').onclick = async () => {
      await this.confirmPrint(attendee);
    };
  }

  async confirmPrint(attendee) {
    const testPrint = document.getElementById('testPrintCheckbox').checked;

    try {
      // Check if printer is connected
      if (!this.printer.isConnected()) {
        const shouldConnect = confirm('No printer connected. Would you like to connect to a printer now?');
        if (shouldConnect) {
          this.closePrintModal();
          this.showPrinterModal();
          return;
        } else {
          throw new Error('No printer connected');
        }
      }

      // Send to Brother printer
      console.log('Printing badge for:', attendee);
      await this.printer.printBadge(attendee, { testPrint });

      if (!testPrint) {
        // Mark as printed in API
        await fetch('/api/badge/print', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attendeeId: attendee._id,
            badgeNumber: attendee.badgeNumber,
            timestamp: new Date().toISOString()
          })
        });
      }

      this.closePrintModal();
      alert(`Badge ${testPrint ? 'test ' : ''}printed for ${attendee.firstName} ${attendee.lastName}`);
    } catch (error) {
      console.error('Print error:', error);
      alert('Error printing badge: ' + error.message);
    }
  }

  closePrintModal() {
    document.getElementById('printModal').style.display = 'none';
    document.getElementById('testPrintCheckbox').checked = false;
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}Tab`);
    });
  }

  showEventSelectionScreen() {
    document.getElementById('eventSelectionScreen').classList.add('active');
    document.getElementById('attendeeScreen').classList.remove('active');
  }

  showAttendeeScreen() {
    document.getElementById('eventSelectionScreen').classList.remove('active');
    document.getElementById('attendeeScreen').classList.add('active');
  }

  // Printer Management Methods
  async loadPrinter() {
    try {
      const savedPrinter = await this.printer.loadSavedPrinter();
      if (savedPrinter) {
        console.log('Saved printer found:', savedPrinter.name);
        this.updatePrinterStatus(savedPrinter.name, false);
      }
    } catch (error) {
      console.error('Error loading saved printer:', error);
    }
  }

  showPrinterModal() {
    const modal = document.getElementById('printerModal');
    modal.style.display = 'flex';

    // Check browser compatibility first
    if (this.printer.browserInfo.isSafari) {
      document.getElementById('printerStatus').innerHTML = `
        <div class="browser-warning">
          <span style="font-size: 3rem;">⚠️</span>
          <h3>Safari Not Supported</h3>
          <p>Web Bluetooth is not available in Safari.</p>
          <p><strong>Please use one of these browsers:</strong></p>
          <ul style="text-align: left; display: inline-block;">
            <li>Google Chrome</li>
            <li>Microsoft Edge</li>
            <li>Opera</li>
          </ul>
          <p style="margin-top: 1rem;">
            <a href="https://www.google.com/chrome/" target="_blank" class="btn btn-primary">
              Download Chrome
            </a>
          </p>
        </div>
      `;
      return;
    }

    if (!this.printer.browserInfo.isSupported) {
      document.getElementById('printerStatus').innerHTML = `
        <div class="browser-warning">
          <span style="font-size: 3rem;">⚠️</span>
          <h3>Browser Not Supported</h3>
          <p>Web Bluetooth is not available in ${this.printer.browserInfo.name}.</p>
          <p><strong>Please use Chrome, Edge, or Opera.</strong></p>
        </div>
      `;
      return;
    }

    // Update status
    const connected = this.printer.isConnected();
    const printerInfo = this.printer.getConnectedPrinter();
    
    if (connected && printerInfo) {
      this.updatePrinterStatus(printerInfo.name, true);
    }

    // Setup event listeners
    document.getElementById('scanPrinterBtn').onclick = () => this.scanForPrinter();
    document.getElementById('testPrinterBtn').onclick = () => this.testPrinter();
    document.getElementById('disconnectPrinterBtn').onclick = () => this.disconnectPrinter();
  }

  closePrinterModal() {
    document.getElementById('printerModal').style.display = 'none';
  }

  updatePrinterStatus(printerName, isConnected) {
    const statusDiv = document.getElementById('printerStatus');
    const infoDiv = document.getElementById('printerInfo');
    const printerNameSpan = document.getElementById('printerName');

    if (isConnected) {
      statusDiv.style.display = 'none';
      infoDiv.style.display = 'block';
      printerNameSpan.textContent = printerName;
    } else {
      statusDiv.style.display = 'block';
      infoDiv.style.display = 'none';
      statusDiv.querySelector('.status-text').textContent = printerName ? 
        `Last connected: ${printerName} (disconnected)` : 
        'No printer connected';
    }
  }

  async scanForPrinter() {
    try {
      const btn = document.getElementById('scanPrinterBtn');
      btn.disabled = true;
      btn.textContent = 'Scanning...';

      const device = await this.printer.scanForPrinters();
      const connectedPrinter = await this.printer.connectToPrinter(device);
      
      this.updatePrinterStatus(connectedPrinter.name, true);
      alert(`Successfully connected to ${connectedPrinter.name}`);
    } catch (error) {
      console.error('Error scanning for printers:', error);
      alert('Error: ' + error.message);
    } finally {
      const btn = document.getElementById('scanPrinterBtn');
      btn.disabled = false;
      btn.innerHTML = '<span class="btn-icon">🔍</span> Scan for Printers';
    }
  }

  async testPrinter() {
    try {
      const btn = document.getElementById('testPrinterBtn');
      btn.disabled = true;
      btn.textContent = 'Printing...';

      await this.printer.testPrint();
      alert('Test print sent successfully!');
    } catch (error) {
      console.error('Test print failed:', error);
      alert('Test print failed: ' + error.message);
    } finally {
      const btn = document.getElementById('testPrinterBtn');
      btn.disabled = false;
      btn.innerHTML = '<span class="btn-icon">🧪</span> Test Print';
    }
  }

  async disconnectPrinter() {
    try {
      await this.printer.disconnect();
      this.updatePrinterStatus(null, false);
      alert('Printer disconnected');
    } catch (error) {
      console.error('Error disconnecting printer:', error);
      alert('Error disconnecting: ' + error.message);
    }
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }

  formatDateRange(courses) {
    const dates = courses.map(c => new Date(c.localizedStartDate));
    const earliest = new Date(Math.min(...dates));
    const latest = new Date(Math.max(...courses.map(c => new Date(c.localizedEndDate))));

    if (earliest.toDateString() === latest.toDateString()) {
      return this.formatDate(earliest);
    }

    return `${this.formatDate(earliest)} - ${this.formatDate(latest)}`;
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.flightDeckApp = new FlightDeckApp();
});
