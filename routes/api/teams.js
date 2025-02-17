const express = require('express');

const router = express.Router();
const { check, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');

const auth = require('../../middleware/auth');

const Match = require('../../models/Match');
const Team = require('../../models/Team');
const User = require('../../models/User');
const Game = require('../../models/Game');

const isInArray = require('../../helpers').isInArray;

// @route     Get api/teams
// @desc      Get all teams by user ID
// @access    Private
router.get('/', auth, async (req, res) => {
  try {
    const teams = await Team.find({ owner: req.user.id }).sort({ date: -1 }).populate('owner', ['username', 'email'], User);
    return res.json(teams);
  } catch (err) {
    console.log(err.message);
    res.status(500).send('Server error');
  }
});

// @route     POST api/teams
// @desc      Create a team
// @access    Private
router.post('/', [auth, [
  check('name', 'Name is required').not().isEmpty(),
  check('matchId', 'Match ID is required').not().isEmpty(),
  check('gameId', 'Game ID is required').not().isEmpty(),
  check('secret', 'Secret is required').not().isEmpty(),
]],
async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, matchId, secret, gameId } = req.body;

  try {
    // Check if game exists
    const game = await Game.findOne({ _id: gameId });
    if (!game) return res.status(400).json({ errors: [{ msg: 'Game not found' }] });

    const match = await Match.findOne({ _id: matchId });
    if (!match) return res.status(400).json({ errors: [{ msg: 'Match not found' }] });

    if (!isInArray(game.players, req.user.id)) return res.status(400).json({ msg: 'User is not a player of the game' });

    // Create team
    const team = new Team({
      name,
      match: matchId,
      owner: req.user.id,
      game: gameId,
      secret,
    });

    const salt = await bcrypt.genSalt(10);
    team.secret = await bcrypt.hash(secret, salt);

    team.members.unshift({ user: req.user.id });
    
    await team.save();

    // Add player to players array in matches
    if (!isInArray(match.players, req.user.id)) match.players.unshift({ user: req.user.id });

    match.teams.unshift(team);

    await match.save();

    return res.json(team);
  } catch (err) {
    console.log(err.message);
    if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Match not found' }); // This runs if the ID passed in is not a valid object id
    res.status(500).send('Server error');
  }
});

// @route     POST api/teams/:teamId
// @desc      Join a team - Joining is ONLY possible if the user is already a player of the match beforehand
// @access    Private
router.post('/:teamId', [auth, [
  check('secret', 'Secret is required').not().isEmpty(),
]],
async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { secret } = req.body;

  try {    
    // Check if team exists
    const team = await Team.findOne({ _id: req.params.teamId });
    if (!team) return res.status(400).json({ errors: [{ msg: 'Team not found' }] });

    // If user is not already a player of the match, he cannot join a team
    const match = await Match.findOne({ _id: team.match });

    if (!isInArray(match.players, req.user.id)) return res.status(400).json({ errors: [{ msg: 'User is unable to join, since he/she is not yet a player of this match' }] });

    // Check if user is already in the team
    if (isInArray(team.members, req.user.id)) return res.status(400).json({ errors: [{ msg: 'User is already a member of this team' }] });

    // Check if secrets match
    const isMatch = await bcrypt.compare(secret, team.secret);
    if (!isMatch) return res.status(400).json({ errors: [{ msg: 'Invalid Secret' }] });
    
    team.members.unshift({ user: req.user.id });
    await team.save();

    return res.json(team);
  } catch (err) {
    console.log(err.message);
    if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Match not found' }); // This runs if the ID passed in is not a valid object id
    res.status(500).send('Server error');
  }
});

// @route     GET api/teams/user
// @desc      Get teams from user ID
// @access    Private
router.get('/user', auth, async (req, res) => {
  try {
    const teams = await Team.find({ members: { user: req.user.id } });
    return res.json(teams);
  } catch (err) {
    console.log(err.message);
    res.status(500).send('Server error');
  }
});

// @route     DELETE api/teams/:id
// @desc      Delete team
// @access    Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const team = await Team.findOne({ _id: req.params.id });
    if (!team) return res.status(404).json({ msg: 'Team not found' });

    // Check user
    if (team.owner.toString() !== req.user.id) return res.status(401).json({ msg: 'User not authorized' });

    await team.remove();

    const match = await Match.findOne({ teams: { _id: req.params.id } });

    const removeIndex = match.teams.map(team => team._id.toString()).indexOf(req.params.id);

    match.teams.splice(removeIndex, 1);

    await match.save();

    return res.json({ msg: 'Team removed' });
  } catch (err) {
    console.log(err.message);
    if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Post not found' }); // This runs if the ID passed in is not a valid object id
    res.status(500).send('Server error');
  }
});

module.exports = router;
