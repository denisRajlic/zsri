const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MatchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  host: {
    type: Schema.Types.ObjectId,
    ref: 'users',
  },
  game: {
    type: Schema.Types.ObjectId,
    ref: 'games',
  },
  teams: [
    {
      type: Schema.Types.ObjectId,
      ref: 'teams',
    }    
  ],
  players: [
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: 'users'
      }
    }
  ],
  secret: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

const Match = mongoose.model('match', MatchSchema);

module.exports = Match;
