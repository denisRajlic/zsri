const express = require('express');

const router = express.Router();
const { check, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');

const auth = require('../../middleware/auth');

const Match = require('../../models/Match');
const Team = require('../../models/Team');
const User = require('../../models/User');
const Game = require('../../models/Game');

const isInArray = require('../../helpers');

// @route     Get api/matches
// @desc      Get all matches created by user
// @access    Private
router.get('/', auth, async (req, res) => {
  try {
    const matches = await Match.find({ host: req.user.id }).populate('host', ['username'], User).populate('teams', [], Team);

    return res.json(matches);
  } catch (err) {
    console.log(err.message);
    res.status(500).send('Server error');
  }
});

// @route     POST api/matches
// @desc      Create match
// @access    Private
router.post('/', [auth, [
  check('secret', 'Name is required').not().isEmpty(),
  check('gameId', 'Game ID is required').not().isEmpty(),
]],
async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, secret, gameId } = req.body;

  try {
    // Check if game exists
    let game = await Game.findOne({ _id: gameId });
    if (!game) return res.status(404).json({ msg: 'Game not found' });

    // Check if user is a player of the game
    if (!isInArray(game.players, req.user.id)) return res.status(400).json({ msg: 'User is not yet a player of this game' });

    // Create match
    const match = new Match({
      name,
      host: req.user.id,
      game: gameId,
      secret,
    });    

    const salt = await bcrypt.genSalt(10);
    match.secret = await bcrypt.hash(secret, salt);

    // Save the user to the DB
    await match.save();

    return res.json(match);
  } catch (err) {
    console.log(err.message);
    if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Match not found' }); // This runs if the ID passed in is not a valid object id
    res.status(500).send('Server error');
  }
});

// @route     GET api/matches/user
// @desc      Get matches user is a part of
// @access    Private
router.get('/user', auth, async (req, res) => {
  try {
    const matches = await Match.find({$or: [
      { players: { _id: req.user.id } },
      { host: { _id: req.user.id } },
    ]});
    return res.json(matches);
  } catch (err) {
    console.log(err.message);
    res.status(500).send('Server error');
  }
});

// @route     POST api/matches/:id
// @desc      Join match
// @access    Private
router.post('/:id', [auth, [
  check('secret', 'Secret is required').not().isEmpty(),
]], 
async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { secret } = req.body;

  try {
    const match = await Match.findOne({ _id: req.params.id });
    if (!match) return res.status(404).json({ msg: 'Match not found' });

    // Check if player is a player of the game
    const game = await Game.findOne({ _id: match.game });

    if (!isInArray(game.players, req.user.id)) return res.status(400).json({ msg: 'User is not yet a player of this game' });

    // Check if user is already in the match
    if (isInArray(match.players, req.user.id)) return res.status(400).json({ errors: [{ msg: 'User is already a player of this match' }] });

    // Check if secrets match
    const isMatch = await bcrypt.compare(secret, match.secret);
    if (!isMatch) return res.status(400).json({ errors: [{ msg: 'Invalid Secret' }] });

    // Add user to players array
    match.players.unshift(req.user.id);
    await match.save();

    return res.json(match.players);
  } catch (err) {
    console.log(err.message);
    if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Match not found' }); // This runs if the ID passed in is not a valid object id
    res.status(500).send('Server error');
  }
});

// @route     DELETE api/matches/:id
// @desc      Delete match
// @access    Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const match = await Match.findOne({ _id: req.params.id });
    if (!match) return res.status(404).json({ msg: 'Match not found' });

    // Check user
    if (match.host.toString() !== req.user.id) return res.status(401).json({ msg: 'User not authorized' });

    await match.remove();

    // Delete all teams from the match
    await Team.deleteMany({ match: req.params.id });

    return res.json({ msg: 'Match removed' });
  } catch (err) {
    console.log(err.message);
    if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Post not found' }); // This runs if the ID passed in is not a valid object id
    res.status(500).send('Server error');
  }
});

module.exports = router;
