const mongoose = require('mongoose');

// const blockSchema = new mongoose.Schema({
//   userId: {
//     type: String,
//     required: true, // User ID of the blocked user
//   },
// }); 

const blockSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  blockedAt: Date,
});

const Block = mongoose.model('Block', blockSchema);         

module.exports = Block;