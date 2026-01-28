const { GraphQLClient } = require('graphql-request');

// CAN API GraphQL client
class CanAPI {
  constructor() {
    // Determine API environment (staging vs production)
    // Use API_ENV if set, otherwise fall back to NODE_ENV
    const apiEnv = process.env.API_ENV || process.env.NODE_ENV || 'staging';
    const isProduction = apiEnv === 'production';
    
    // Select appropriate URL (allow override via CAN_API_URL)
    const apiUrl = process.env.CAN_API_URL || (
      isProduction 
        ? 'https://can.sandsmedia.com/graphql'
        : 'https://can-stage.sandsmedia.com/graphql'
    );
    
    // Get access token based on environment
    const accessToken = isProduction 
      ? process.env.CAN_PROD_TOKEN 
      : process.env.CAN_STAGE_TOKEN;
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Add authorization header if token is provided
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    this.client = new GraphQLClient(apiUrl, { headers });
    
    console.log(`📡 CAN API initialized (${apiEnv}): ${apiUrl}`);
    console.log(`🔑 Auth token: ${accessToken ? 'Present' : 'Missing'}`);
  }

  /**
   * Generic query method for CAN API
   * @param {string} query - GraphQL query string
   * @param {Object} variables - Query variables
   */
  async query(query, variables = {}) {
    try {
      const data = await this.client.request(query, variables);
      return data;
    } catch (error) {
      console.error('CAN API query error:', error);
      throw error;
    }
  }

  /**
   * Generic mutation method for CAN API
   * @param {string} mutation - GraphQL mutation string
   * @param {Object} variables - Mutation variables
   */
  async mutate(mutation, variables = {}) {
    try {
      const data = await this.client.request(mutation, variables);
      return data;
    } catch (error) {
      console.error('CAN API mutation error:', error);
      throw error;
    }
  }

  // Add specific CAN API methods here as needed
  
  /**
   * Fetch attendees for a course (or multiple courses)
   * @param {string|string[]} courseId - Course ID or array of course IDs
   */
  async getAttendees(courseId) {
    // Support both single courseId and array of courseIds
    const courseIds = Array.isArray(courseId) ? courseId : [courseId];
    
    const query = `
      query GetAttendees($courseIds: [String!]!) {
        privateAttendees(from: "REDSYS", courseId_in: $courseIds) {
          Attendees {
            _id
            courseId
            courseIds
            combinedCourseName
            logo
            localizedStartDate
            localizedEndDate
            type
            types
            attendMode
            checkInState
            additions {
              duration
              type
            }
            userId
            swapCardEmail
            supportedApps
            firstName
            lastName
            days
            dates
            workshopNames
            specialDayNames
            specialDayUniqueIds
            badgeNumber
            badgeBarcodeUrl
            badgeDays
            updatedAt
          }
        }
      }
    `;
    
    try {
      const data = await this.query(query, { courseIds });
      return data.privateAttendees?.Attendees || [];
    } catch (error) {
      console.error('Error fetching attendees:', error);
      throw error;
    }
  }

  /**
   * Fetch user data
   * @param {string} userId - User ID
   */
  async getUser(userId) {
    const query = `
      query GetUser($userId: ID!) {
        user(id: $userId) {
          _id
          email
          firstName
          lastName
        }
      }
    `;
    
    try {
      const data = await this.query(query, { userId });
      return data.user;
    } catch (error) {
      console.error('Error fetching user:', error);
      throw error;
    }
  }
}

module.exports = new CanAPI();
