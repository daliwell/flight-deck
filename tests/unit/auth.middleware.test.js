const { ensureAuthenticated, ensureSandsMediaDomain, requireSandsMediaAuth } = require('../../src/middleware/auth');

describe('Authentication Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      isAuthenticated: jest.fn(),
      session: {},
      originalUrl: '/test',
      user: null
    };
    res = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  describe('ensureAuthenticated', () => {
    it('should call next() if user is authenticated', () => {
      req.isAuthenticated.mockReturnValue(true);

      ensureAuthenticated(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it('should redirect to /auth/login if not authenticated', () => {
      req.isAuthenticated.mockReturnValue(false);

      ensureAuthenticated(req, res, next);

      expect(res.redirect).toHaveBeenCalledWith('/auth/login');
      expect(next).not.toHaveBeenCalled();
    });

    it('should store original URL in session', () => {
      req.isAuthenticated.mockReturnValue(false);
      req.originalUrl = '/some/protected/page';

      ensureAuthenticated(req, res, next);

      expect(req.session.returnTo).toBe('/some/protected/page');
    });
  });

  describe('ensureSandsMediaDomain', () => {
    it('should call next() if user is from sandsmedia.com', () => {
      req.isAuthenticated.mockReturnValue(true);
      req.user = {
        email: 'test@sandsmedia.com',
        domain: 'sandsmedia.com'
      };

      ensureSandsMediaDomain(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 403 if user is not from sandsmedia.com', () => {
      req.isAuthenticated.mockReturnValue(true);
      req.user = {
        email: 'test@example.com',
        domain: 'example.com'
      };

      ensureSandsMediaDomain(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied. Only sandsmedia.com domain accounts are allowed.'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if user is not authenticated', () => {
      req.isAuthenticated.mockReturnValue(false);

      ensureSandsMediaDomain(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireSandsMediaAuth', () => {
    it('should be an array of middleware functions', () => {
      expect(Array.isArray(requireSandsMediaAuth)).toBe(true);
      expect(requireSandsMediaAuth).toHaveLength(2);
    });
  });
});
