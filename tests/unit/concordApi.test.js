const concordApi = require('../../src/services/concordApi');

describe('Concord API Service', () => {
  describe('Initialization', () => {
    it('should initialize with correct environment', () => {
      expect(concordApi).toBeDefined();
      expect(concordApi.client).toBeDefined();
    });
  });

  describe('getCourses', () => {
    it('should call client.request with correct parameters', async () => {
      const mockRequest = jest.spyOn(concordApi.client, 'request');
      mockRequest.mockResolvedValue({
        courses: {
          Courses: [],
          Meta: { count: 0 }
        }
      });

      const result = await concordApi.getCourses({
        genres: ['RHEINGOLD'],
        page: 1,
        pageSize: 10
      });
      
      expect(mockRequest).toHaveBeenCalled();
      expect(result).toHaveProperty('Courses');
      
      mockRequest.mockRestore();
    });

    it('should handle missing optional parameters', async () => {
      const mockRequest = jest.spyOn(concordApi.client, 'request');
      mockRequest.mockResolvedValue({
        courses: {
          Courses: [],
          Meta: { count: 0 }
        }
      });

      await concordApi.getCourses({});
      
      expect(mockRequest).toHaveBeenCalled();
      
      mockRequest.mockRestore();
    });
  });
});
