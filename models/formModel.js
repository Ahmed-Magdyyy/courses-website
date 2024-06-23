const mongoose = require('mongoose');

const formSchema = new mongoose.Schema({
  name: { type: String, required: true },
  questions: [{
    _id: false,
    type: String,  // Question text
    required: true
  }]
});

module.exports = mongoose.model('form', formSchema);
