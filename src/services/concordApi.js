const { GraphQLClient } = require('graphql-request');

// Concord API GraphQL client
class ConcordAPI {
  constructor() {
    // Determine API environment (staging vs production)
    // Use API_ENV if set, otherwise fall back to NODE_ENV
    const apiEnv = process.env.API_ENV || process.env.NODE_ENV || 'staging';
    const isProduction = apiEnv === 'production';
    
    // Select appropriate URL (allow override via CONCORD_API_URL)
    const apiUrl = process.env.CONCORD_API_URL || (
      isProduction 
        ? 'https://concord.sandsmedia.com/graphql'
        : 'https://concord-stage.sandsmedia.com/graphql'
    );
    
    // Get access token based on environment
    const accessToken = isProduction 
      ? process.env.CONCORD_PROD_TOKEN 
      : process.env.CONCORD_STAGE_TOKEN;
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Add authorization header if token is provided
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    this.client = new GraphQLClient(apiUrl, { headers });
    
    console.log(`📡 Concord API initialized (${apiEnv}): ${apiUrl}`);
    console.log(`🔑 Auth token: ${accessToken ? 'Present' : 'Missing'}`);
  }

  /**
   * Fetch courses (events) filtered by genre and date
   * @param {Object} params - Query parameters
   * @param {Array<string>} params.genres - Array of genres (RHEINGOLD, CAMP, FLEX_CAMP)
   * @param {string} params.startDateFrom - Filter courses starting from this date
   * @param {number} params.page - Page number
   * @param {number} params.pageSize - Page size
   */
  async getCourses({ genres = ['RHEINGOLD'], startDateFrom = '2026-01-01', page = 1, pageSize = 100 }) {
    const query = `
      query GetCourses($genres: [COURSE_GENRE!], $startDateFrom: String, $page: Int, $pageSize: Int) {
        courses(
          genre_in: $genres
          localizedStartDate_gte: $startDateFrom
          SORTS: [
            {localizedStartDate: -1},
            {name: 1}
          ]
          PAGE: $page
          PAGE_SIZE: $pageSize
        ) {
          Meta {
            count
          }
          Courses {
            _id
            genre
            shortName
            name
            localizedStartDate
            localizedEndDate
            timezone
            colourHexCode
            transparentLogo {
              svg
            }
            location {
              city
            }
            supportedApps
          }
        }
      }
    `;

    const variables = {
      genres,
      startDateFrom,
      page,
      pageSize
    };

    try {
      const data = await this.client.request(query, variables);
      return data.courses;
    } catch (error) {
      console.error('Error fetching courses:', error);
      throw error;
    }
  }

  /**
   * Mark badge as printed (mutation to be provided later)
   * @param {string} attendeeId - Attendee ID
   */
  async markBadgePrinted(attendeeId) {
    // TODO: Implement when mutation is provided
    console.log('Badge printed for attendee:', attendeeId);
    return { success: true };
  }
}

module.exports = new ConcordAPI();
