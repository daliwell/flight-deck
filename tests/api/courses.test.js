const request = require('supertest');
const express = require('express');
const session = require('express-session');
const apiRoutes = require('../../src/routes/api');
const concordApi = require('../../src/services/concordApi');
const canApi = require('../../src/services/canApi');

// Mock APIs
jest.mock('../../src/services/concordApi');
jest.mock('../../src/services/canApi');

describe('API Routes', () => {
  let app;

  beforeEach(() => {
    // Create fresh Express app for each test
    app = express();
    app.use(express.json());
    
    // Mock session middleware
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false
    }));
    
    // Mock authentication - set user in session
    app.use((req, res, next) => {
      req.session.passport = { user: { email: 'test@sandsmedia.com' } };
      req.user = { email: 'test@sandsmedia.com' };
      req.isAuthenticated = () => true;
      next();
    });
    
    app.use('/api', apiRoutes);
    
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('GET /api/courses', () => {
    const mockCoursesResponse = {
      Meta: { count: 2 },
      Courses: [
        {
          _id: 'course1',
          genre: 'RHEINGOLD',
          name: 'Test Course 1',
          localizedStartDate: '2026-02-01'
        },
        {
          _id: 'course2',
          genre: 'CAMP',
          name: 'Test Course 2',
          localizedStartDate: '2026-02-15'
        }
      ]
    };

    it('should handle single genre as string', async () => {
      concordApi.getCourses.mockResolvedValue(mockCoursesResponse);

      const response = await request(app)
        .get('/api/courses?genres=RHEINGOLD')
        .expect(200);

      expect(concordApi.getCourses).toHaveBeenCalledWith(
        expect.objectContaining({
          genres: ['RHEINGOLD']
        })
      );
      expect(response.body).toEqual(mockCoursesResponse);
    });

    it('should handle comma-separated genres string (Edge iOS compatibility)', async () => {
      concordApi.getCourses.mockResolvedValue(mockCoursesResponse);

      const response = await request(app)
        .get('/api/courses?genres=RHEINGOLD,CAMP,FLEX_CAMP')
        .expect(200);

      expect(concordApi.getCourses).toHaveBeenCalledWith(
        expect.objectContaining({
          genres: ['RHEINGOLD', 'CAMP', 'FLEX_CAMP']
        })
      );
      expect(response.body).toEqual(mockCoursesResponse);
    });

    it('should handle genres as array', async () => {
      concordApi.getCourses.mockResolvedValue(mockCoursesResponse);

      // Express parses multiple same-named params as array
      const response = await request(app)
        .get('/api/courses?genres[]=RHEINGOLD&genres[]=CAMP')
        .expect(200);

      expect(concordApi.getCourses).toHaveBeenCalledWith(
        expect.objectContaining({
          genres: expect.arrayContaining(['RHEINGOLD', 'CAMP'])
        })
      );
    });

    it('should trim whitespace from comma-separated genres', async () => {
      concordApi.getCourses.mockResolvedValue(mockCoursesResponse);

      const response = await request(app)
        .get('/api/courses?genres=RHEINGOLD, CAMP, FLEX_CAMP')
        .expect(200);

      expect(concordApi.getCourses).toHaveBeenCalledWith(
        expect.objectContaining({
          genres: ['RHEINGOLD', 'CAMP', 'FLEX_CAMP']
        })
      );
    });

    it('should use default genre when not provided', async () => {
      concordApi.getCourses.mockResolvedValue(mockCoursesResponse);

      await request(app)
        .get('/api/courses')
        .expect(200);

      expect(concordApi.getCourses).toHaveBeenCalledWith(
        expect.objectContaining({
          genres: ['RHEINGOLD']
        })
      );
    });

    it('should pass through other query parameters', async () => {
      concordApi.getCourses.mockResolvedValue(mockCoursesResponse);

      await request(app)
        .get('/api/courses?startDateFrom=2026-03-01&page=2&pageSize=50')
        .expect(200);

      expect(concordApi.getCourses).toHaveBeenCalledWith(
        expect.objectContaining({
          startDateFrom: '2026-03-01',
          page: 2,
          pageSize: 50
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      concordApi.getCourses.mockRejectedValue(new Error('GraphQL error'));

      const response = await request(app)
        .get('/api/courses')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to fetch courses',
        message: 'GraphQL error'
      });
    });
  });

  describe('GET /api/attendees/:courseId', () => {
    const mockAttendees = [
      {
        _id: 'attendee1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        status: 'CONFIRMED'
      },
      {
        _id: 'attendee2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        status: 'CONFIRMED'
      }
    ];

    it('should fetch attendees for a single course', async () => {
      canApi.getAttendees.mockResolvedValue(mockAttendees);

      const response = await request(app)
        .get('/api/attendees/course123')
        .expect(200);

      expect(canApi.getAttendees).toHaveBeenCalledWith('course123');
      expect(response.body).toEqual({
        success: true,
        count: 2,
        attendees: mockAttendees
      });
    });

    it('should handle empty attendee list', async () => {
      canApi.getAttendees.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/attendees/course456')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        count: 0,
        attendees: []
      });
    });

    it('should handle API errors gracefully', async () => {
      canApi.getAttendees.mockRejectedValue(new Error('CAN API error'));

      const response = await request(app)
        .get('/api/attendees/course789')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to fetch attendees',
        message: 'CAN API error'
      });
    });
  });

  describe('POST /api/attendees/bulk', () => {
    const mockAttendees1 = [
      { _id: 'att1', firstName: 'John', lastName: 'Doe' }
    ];
    const mockAttendees2 = [
      { _id: 'att2', firstName: 'Jane', lastName: 'Smith' },
      { _id: 'att3', firstName: 'Bob', lastName: 'Jones' }
    ];

    it('should fetch attendees for multiple courses', async () => {
      canApi.getAttendees
        .mockResolvedValueOnce(mockAttendees1)
        .mockResolvedValueOnce(mockAttendees2);

      const response = await request(app)
        .post('/api/attendees/bulk')
        .send({ courseIds: ['course1', 'course2'] })
        .expect(200);

      expect(canApi.getAttendees).toHaveBeenCalledTimes(2);
      expect(canApi.getAttendees).toHaveBeenCalledWith('course1');
      expect(canApi.getAttendees).toHaveBeenCalledWith('course2');
      
      expect(response.body).toEqual({
        success: true,
        count: 3,
        attendees: [...mockAttendees1, ...mockAttendees2]
      });
    });

    it('should reject empty courseIds array', async () => {
      const response = await request(app)
        .post('/api/attendees/bulk')
        .send({ courseIds: [] })
        .expect(400);

      expect(response.body).toEqual({
        error: 'courseIds must be a non-empty array'
      });
    });

    it('should reject missing courseIds', async () => {
      const response = await request(app)
        .post('/api/attendees/bulk')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        error: 'courseIds must be a non-empty array'
      });
    });

    it('should reject non-array courseIds', async () => {
      const response = await request(app)
        .post('/api/attendees/bulk')
        .send({ courseIds: 'course1' })
        .expect(400);

      expect(response.body).toEqual({
        error: 'courseIds must be a non-empty array'
      });
    });

    it('should handle API errors gracefully', async () => {
      canApi.getAttendees.mockRejectedValue(new Error('CAN API error'));

      const response = await request(app)
        .post('/api/attendees/bulk')
        .send({ courseIds: ['course1'] })
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to fetch attendees',
        message: 'CAN API error'
      });
    });
  });
});
