const mongoose = require('mongoose');

const pocEmbeddingsSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  pocId: {
    type: String,
    required: true,
    ref: 'ChunkAuditPoc'
  },
  embedding: {
    type: [Number],
    required: true
  },
  embeddingModel: {
    type: String,
    default: ''
  },
  total: {
    type: Number,
    required: true
  },
  index: {
    type: Number,
    required: true
  },
  text: {
    type: String,
    required: true
  },
  abstract: {
    type: String,
    default: ''
  },
  contentType: String,
  expertSearchNames: String,
  experts: [mongoose.Schema.Types.Mixed],
  indexBrandName: String,
  indexSeriesName: String,
  language: String,
  parentDescription: String,
  parentId: String,
  parentName: String,
  primaryCategoryNames: String,
  secondaryCategoryNames: String,
  sortDate: Date,
  sortYear: String,
  subtitle: String,
  supportedApps: [String],
  tertiaryCategoryNames: String,
  title: String,
  summaryDe: String,
  summaryEn: String,
  summaryNl: String,
  isSlide: {
    type: Boolean,
    default: false
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  collection: 'pocEmbeddings'
});

module.exports = mongoose.model('PocEmbedding', pocEmbeddingsSchema);