const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Primary connection to CAN database
    const mongoUriCan = global.appConfig?.MONGODB_URI_CAN || process.env.MONGODB_URI_CAN;
    
    if (!mongoUriCan) {
      throw new Error('MongoDB URI for CAN database not found in configuration or environment variables');
    }

    const connCan = await mongoose.connect(mongoUriCan, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB CAN Connected: ${connCan.connection.host}`);

    // Secondary connection to FAUST database for articles
    const mongoUriFaust = global.appConfig?.MONGODB_URI_FAUST || process.env.MONGODB_URI_FAUST;
    
    if (!mongoUriFaust) {
      throw new Error('MongoDB URI for FAUST database not found in configuration or environment variables');
    }

    const connFaust = await mongoose.createConnection(mongoUriFaust, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB FAUST Connected: ${connFaust.host}`);
    
    // Store the FAUST connection globally for Article model to use
    global.faustConnection = connFaust;

    console.log('Database connection using:', global.appConfig ? 'AWS Parameter Store' : 'Environment Variables');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;