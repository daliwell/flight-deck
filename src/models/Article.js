const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema({
  _id: { type: String },
  name: String,
  subtitle: String,
  abstract: String,
  content: String,
  searchContent: String,
  htmlContent: String,
  images: [String]  // Array of S3 URLs
}, {
  collection: 'articles',
  timestamps: false,
  versionKey: false
});

// Use the FAUST connection for Article model
const getArticleModel = () => {
  if (global.faustConnection) {
    return global.faustConnection.model('Article', articleSchema);
  } else {
    // Fallback to default connection during startup
    return mongoose.model('Article', articleSchema);
  }
};

module.exports = getArticleModel;