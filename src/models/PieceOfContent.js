const mongoose = require('mongoose');

const pieceOfContentsSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  }
  // All other fields are dynamic and stored without strict schema validation
}, {
  timestamps: true,
  collection: 'pieceOfContents',
  _id: false,  // Disable auto ObjectId generation since we're using string _id
  strict: false  // Allow any fields not defined in schema
});

module.exports = mongoose.model('PieceOfContent', pieceOfContentsSchema);