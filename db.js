var kind = 'Game';
var gcloud = require('gcloud');
var ds = gcloud.datastore.dataset({projectId: 'electric-orbit-120901'});

var chess = require('./public/chess.js');

function toDs(instance){
	var key = instance.id ? ds.key([kind, parseInt(instance.id, 10)]) : ds.key(kind);
	instance.id = key.id;
	var data = [{name : 'game', value : JSON.stringify(instance.game), excludeFromIndexes : true}];
	return {key : key, data : data};
}

function fromDs(entity){
	return {id : entity.key.id, game : JSON.parse(entity.data.game)};
}

function getInstance(cb){
	var q = ds.createQuery([kind]);
	ds.runQuery(q, function(err, entities, nextQuery) {
		if(entities.length == 0)
			create(cb);
		else
			cb(fromDs(entities[0]));
	});
}

function create(cb){
	var game = chess.game();
	chess.setup(game);
	var instance = {game:game};
	var en = toDs(instance);
	ds.save(en, function(e){console.log(e);});
	cb(instance);
}

function saveInstance(instance){
	ds.save(toDs(instance), function(e){if(e) console.log(e);});
}

module.exports = {getInstance : getInstance, saveInstance : saveInstance}