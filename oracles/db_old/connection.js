const mongoose = require('mongoose');

const mongo_uri = 'mongodb://localhost:27017/fyp';
mongoose.connect(mongo_uri, { useNewUrlParser: true }, (error) => {
	if (error) {
		console.log('Error:- Could not obtain connection to MongoDB server');
		console.log('ErrorMsg:- ' + error);
	}
});
const db = mongoose.connection;

module.exports = db;
