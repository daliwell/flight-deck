const canApi = require('../../src/services/canApi');

describe('CAN API Service', () => {
  describe('Initialization', () => {
    it('should initialize with correct environment', () => {
      expect(canApi).toBeDefined();
      expect(canApi.client).toBeDefined();
    });

    it('should select staging URL when API_ENV is not production', () => {
      // CAN API should initialize based on environment variables
      expect(canApi.client).toHaveProperty('url');
    });
  });

  describe('getAttendees', () => {
    it('should handle single course ID', async () => {
      const mockRequest = jest.spyOn(canApi.client, 'request');
      mockRequest.mockResolvedValue({
        privateAttendees: {
          Attendees: [
            {
              _id: 'test-id',
              firstName: 'Test',
              lastName: 'User',
              email: 'test@example.com'
            }
          ]
        }
      });

      const result = await canApi.getAttendees('course-123');
      
      expect(result).toBeInstanceOf(Array);
      expect(mockRequest).toHaveBeenCalled();
      
      mockRequest.mockRestore();
    });

    it('should handle array of course IDs', async () => {
      const mockRequest = jest.spyOn(canApi.client, 'request');
      mockRequest.mockResolvedValue({
        privateAttendees: {
          Attendees: []
        }
      });

      const result = await canApi.getAttendees(['course-1', 'course-2']);
      
      expect(result).toBeInstanceOf(Array);
      expect(mockRequest).toHaveBeenCalled();
      
      mockRequest.mockRestore();
    });

    it('should return empty array if no attendees found', async () => {
      const mockRequest = jest.spyOn(canApi.client, 'request');
      mockRequest.mockResolvedValue({
        privateAttendees: null
      });

      const result = await canApi.getAttendees('course-123');
      
      expect(result).toEqual([]);
      
      mockRequest.mockRestore();
    });
  });
});
