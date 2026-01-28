/**
 * IndexedDB Service for Flight Deck
 * Stores events and attendees locally for offline access
 */

class FlightDeckDB {
  constructor() {
    this.dbName = 'FlightDeckDB';
    this.version = 1;
    this.db = null;
  }

  /**
   * Initialize the database
   */
  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Events store (grouped courses)
        if (!db.objectStoreNames.contains('events')) {
          const eventStore = db.createObjectStore('events', { keyPath: 'id' });
          eventStore.createIndex('city', 'city', { unique: false });
          eventStore.createIndex('startDate', 'startDate', { unique: false });
          eventStore.createIndex('cityAndDate', ['city', 'startDate'], { unique: false });
        }

        // Courses store (individual courses within events)
        if (!db.objectStoreNames.contains('courses')) {
          const courseStore = db.createObjectStore('courses', { keyPath: '_id' });
          courseStore.createIndex('eventId', 'eventId', { unique: false });
          courseStore.createIndex('name', 'name', { unique: false });
        }

        // Attendees store
        if (!db.objectStoreNames.contains('attendees')) {
          const attendeeStore = db.createObjectStore('attendees', { keyPath: '_id' });
          attendeeStore.createIndex('courseId', 'courseId', { unique: false });
          attendeeStore.createIndex('badgeNumber', 'badgeNumber', { unique: false });
          attendeeStore.createIndex('firstName', 'firstName', { unique: false });
          attendeeStore.createIndex('lastName', 'lastName', { unique: false });
          attendeeStore.createIndex('fullName', 'fullName', { unique: false });
          attendeeStore.createIndex('checkInState', 'checkInState', { unique: false });
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Save events to the database
   */
  async saveEvents(events) {
    await this.init();
    const tx = this.db.transaction('events', 'readwrite');
    const store = tx.objectStore('events');

    for (const event of events) {
      await store.put(event);
    }

    return tx.complete;
  }

  /**
   * Get all events
   */
  async getEvents() {
    await this.init();
    const tx = this.db.transaction('events', 'readonly');
    const store = tx.objectStore('events');
    return store.getAll();
  }

  /**
   * Get event by ID
   */
  async getEvent(eventId) {
    await this.init();
    const tx = this.db.transaction('events', 'readonly');
    const store = tx.objectStore('events');
    return store.get(eventId);
  }

  /**
   * Save courses to the database
   */
  async saveCourses(courses) {
    await this.init();
    const tx = this.db.transaction('courses', 'readwrite');
    const store = tx.objectStore('courses');

    for (const course of courses) {
      await store.put(course);
    }

    return tx.complete;
  }

  /**
   * Get courses for an event
   */
  async getCoursesByEvent(eventId) {
    await this.init();
    const tx = this.db.transaction('courses', 'readonly');
    const store = tx.objectStore('courses');
    const index = store.index('eventId');
    return index.getAll(eventId);
  }

  /**
   * Save attendees to the database
   */
  async saveAttendees(attendees) {
    await this.init();
    const tx = this.db.transaction('attendees', 'readwrite');
    const store = tx.objectStore('attendees');

    for (const attendee of attendees) {
      // Add fullName for easier searching
      attendee.fullName = `${attendee.firstName} ${attendee.lastName}`.toLowerCase();
      await store.put(attendee);
    }

    return tx.complete;
  }

  /**
   * Get all attendees for a course
   */
  async getAttendeesByCourse(courseId) {
    await this.init();
    const tx = this.db.transaction('attendees', 'readonly');
    const store = tx.objectStore('attendees');
    const index = store.index('courseId');
    return index.getAll(courseId);
  }

  /**
   * Get attendee by badge number
   */
  async getAttendeeByBadgeNumber(badgeNumber) {
    await this.init();
    const tx = this.db.transaction('attendees', 'readonly');
    const store = tx.objectStore('attendees');
    const index = store.index('badgeNumber');
    return index.get(badgeNumber);
  }

  /**
   * Search attendees by name
   */
  async searchAttendees(searchTerm) {
    await this.init();
    const tx = this.db.transaction('attendees', 'readonly');
    const store = tx.objectStore('attendees');
    const allAttendees = await store.getAll();

    const term = searchTerm.toLowerCase();
    return allAttendees.filter(attendee => 
      attendee.fullName.includes(term) ||
      attendee.firstName.toLowerCase().includes(term) ||
      attendee.lastName.toLowerCase().includes(term) ||
      (attendee.badgeNumber && attendee.badgeNumber.includes(term))
    );
  }

  /**
   * Get or set settings
   */
  async getSetting(key) {
    await this.init();
    const tx = this.db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const result = await store.get(key);
    return result ? result.value : null;
  }

  async setSetting(key, value) {
    await this.init();
    const tx = this.db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    await store.put({ key, value });
    return tx.complete;
  }

  /**
   * Clear all data
   */
  async clearAll() {
    await this.init();
    const storeNames = ['events', 'courses', 'attendees'];
    const tx = this.db.transaction(storeNames, 'readwrite');
    
    for (const storeName of storeNames) {
      tx.objectStore(storeName).clear();
    }

    return tx.complete;
  }
}

// Export singleton instance
const flightDeckDB = new FlightDeckDB();
