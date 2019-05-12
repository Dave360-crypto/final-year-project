var express = require('express');
var router = express.Router();

// DB dependencies
var crypto = require('crypto');
var path = require('path');
var mongoose = require('mongoose');
var multer = require('multer');
var gridFsStorage = require('multer-gridfs-storage');
var grid = require('gridfs-stream');

const Session = require('../../../db/models/Session').Session;
const User = require('../../../db/models/User').User;

// Setup DB
const mongoUri = 'mongodb://localhost:27017/fyp';

// Create connection
const conn = mongoose.createConnection(mongoUri, {
	useNewUrlParser: true
});

let gfs;
conn.once('open', () => {
	gfs = grid(conn.db, mongoose.mongo);
});

var storage = new gridFsStorage({
	url: 'mongodb://localhost:27017/fyp',
	file: (req, file) => {
		return new Promise((resolve, reject) => {
			crypto.randomBytes(16, (err, buf) => {
				if (err) {
					return reject(err);
				} else {
					const filename = buf.toString('hex') + path.extname(file.originalname);
					const file_info = {
						filename: filename,
						bucketname: 'uploads'
					};
					resolve(file_info);
				}
			});
		});
	}
});
const upload = multer({ storage });

/* POST - upload sale contract */
router.post('/:session_id/upload-sc/', upload.single('file'), (req, res,next) => {
	var fileId = req.file.id
	Session.updateOne({
		_id: req.params.session_id
	}, { $set: {
		'stages.3.sale_contract_id': fileId
	}}, (error, result) => {
		if (error) {
			console.log(error);
		} else {
			console.log(result);
			res.json({
				message: 'uploaded'
			});
		}
	});
});

/* POST - upload signed sale contract */
router.post('/:session_id/upload-ssc/', upload.single('file'), (req, res,next) => {
	var fileId = req.file.id
	Session.updateOne({
		_id: req.params.session_id
	}, { $set: {
		'stages.3.signed_sale_contract_id': fileId
	}}, (error, result) => {
		if (error) {
			console.log(error);
		} else {
			console.log(result);
			res.json({
				message: 'uploaded'
			});
		}
	});
});

/* GET - sale contract (sc or ssc) */
router.get('/:session_id/contract/:type', (req, res, next) => {
	// Get contract id
	Session.findOne({
		_id: req.params.session_id
	}, (err, session) => {
		if (err) {
			console.log(err);
		} else {
			var contractId;
			if (req.params.type == 'sc') {
				contractId = session.stages['3'].sale_contract_id
			} else if (req.params.type == 'ssc') {
				contractId = session.stages['3'].signed_sale_contract_id
			}
			sendContract(contractId, res, next);
		}
	});
});

function sendContract(contractId, res, next)  {
	gfs.files.findOne({
		_id: mongoose.Types.ObjectId(contractId)
	}, (err, contract) => {
		if (err) {
			console.log(err);
		} else {

			var rs = gfs.createReadStream({
				filename: contract.filename
			});

			res.set('Content-Type', contract.contentType);
			res.set('Content-Disposition', 'attachment; filename="' + contract.filename + '"');

			rs.on('error', (err) => {
				res.end();
			});
			rs.pipe(res);
		}
	});
}

/* GET session listing. */
router.get('/', function(req, res, next) {
	Session.find((err, docs) => {
		if (err) console.error(err);
		res.json({
			docs: docs
		});
	});
});

/* GET session by id*/
router.get('/get/:session_id', (req, res, next) => {
	const session_id = req.params.session_id;
	Session.findOne({
		_id: session_id
	}, (err, result) => {
		if (err) console.error(err);
		res.json({
			result: result
		});
	});
});

/* POST - create a session */
router.post('/create', (req, res, next) => {
	Session.findOne({
		property_id: req.body.property_id
	})
	.then(session => {
		if (session) {
			console.log("Found a session");
			handleError("Session with that property already exists", res, next);
		}
		else {
			console.log("Creating a new session");
			Session.create({
				property_id: req.body.property_id,
				buyer_id: req.body.buyer_id,
				seller_id: req.body.seller_id,
				buyer_address: req.body.buyer_address,
				seller_address: req.body.seller_address
			}, (err, session) => {
				if (err) console.error(err);
				console.log('Linking session to participants...');
				linkSessionToParticipants(session._id, session.buyer_id, session.seller_id,
				res, next);
			});
		}
	});
});

function linkSessionToParticipants(session_id, buyer_id, seller_id, res, next) {
	// First the seller
	User.updateOne({
		_id: seller_id
	}, {
		$push: {
			'profiles.seller.sessions': session_id
		}
	}, (err, result) => {
		if (err) console.log(err);
		console.log(result);
		console.log('Finished linking session to seller... now buyer...');
		// Then the buyer
		User.updateOne({
			_id: buyer_id
		}, {
			$push: {
				'profiles.buyer.sessions': session_id
			}
		}, (err, result) => {
			if (err) console.log(err);
			console.log(result);
			console.log('Finished linking session to buyer');
			res.json({
				message: 'Linked session to participants successfully'
			});
		});
	});
}

/* PUT - update a session */
router.put('/:session_id/update', (req, res, next) =>  {
	console.log('Updating session with id: ' + req.params.session_id);
	Session.updateOne({
		_id: req.params.session_id
	}, req.body.updateOptions, (err) => {
		if (err) handleError(err, res, next);
		res.send(`Successfully updated Session #: ${req.params.session_id}`);
	});
});

/* DELETE - delete a session */
router.delete('/:session_id/delete', (req, res, next) => {
	Session.deleteOne({
		_id: req.params.session_id
	}, (err) => {
		if (err) handleError(err, res, next);
		res.send(`Session ${req.params.session_id} was deleted successfully`);
	});
});

// Error handling
function handleError(errorMsg, res, next) {
	const error = new Error(errorMsg);
	next(error);
}

module.exports = router;
