const mongoose = require('mongoose');

const formSchema = new mongoose.Schema({
  name: { type: String, required: true },
  questions: [{
    _id: false,
    type: String,  // Question text
    required: true
  }],
  submissionsCount: { type: Number, default: 0 } 
});

module.exports = mongoose.model('form', formSchema);
