/**
 * Created by Ravis on 25/05/15.
 */

var express = require('express'),
  mongo = require('../db/mongo'),
  geohash = require('../util/geohash'),
  _ = require('underscore');

var router = express.Router();

/**
 *
 * @param bottomLeft
 * @param upperRight
 * @param fullCrop
 * @returns {{query: *[], geoHashes: *[], resolutionFactor: *}}
 */
var constructQuery = function(bottomLeft, upperRight, zoom, fullCrop) {
  ////Calculate resolution factor for clustering
  //Calculate geohashes of bbox corners
  var blHash = geohash.encodeGeoHash(bottomLeft[0], bottomLeft[1]);
  var urHash = geohash.encodeGeoHash(upperRight[0], upperRight[1]);
  //Find out their common length
  var commonLength;
  for (commonLength = 0; commonLength < blHash.length; commonLength++)
    if (blHash[commonLength] !== urHash[commonLength]) break;
  //Increment it by some another factor (this will give clustering power)
  var incFactor = 3;
  ////Construct aggregate query
  var aggregation = {
    query: [
      {
        $project: {
          _id: 0,
          "geo": {
            "$substr": ["$properties.geohash", 0, commonLength + incFactor]
          },
          "properties": 1,
          "geometry": 1
        }
      },
      {
        $match: {
          "geometry": {
            $geoWithin: {
              $box: [
                bottomLeft,
                upperRight
              ]
            }
          }
        }
      },
      {
        $group: {
          _id: "$geo",
          "count": {
            $sum: 1
          },
          "pointsData": {
            $push: {
              properties: "$properties",
              coordinates: "$geometry.coordinates"
            }
          }
        }
      }
    ],
    geoHashes: [blHash, urHash],
    resolutionFactor: commonLength + incFactor
  };
  ////To crop arrays inside Mongo or not to crop
  //1) Cropping inside MongoDB
  // If we perform cropping inside Mongo, we save traffic between Mongo, also we save Back-Ends CPU
  // But for now, there is no way to slice array inside aggregation pipeline of MongoDB
  // The only way is to delete whole array, leaving only count
  //2) Cropping in Back-End
  // We're devs, we can do all we want, but be careful with performance
  // All 100500 docs of each group will be here (actually their cursor?) after this query completes
  if (fullCrop) {
    aggregation.query.push({
      $project: {
        "count": 1,
        "pointsData": {
          $cond: {
            if: {
              $lt: ["$count", 6]
            },
            then: "$pointsData",
            else: "cropped"
          }
        }
      }
    });
  }
  return aggregation;
};

/**
 *
 * @param req
 * @param res
 * @param next
 */
var validate = function(req, res, next) {
  var query = req.query;
  if (query.bl && query.ur){
    var blLong = query.bl.long;
    var blLat = query.bl.lat;
    var urLong = query.ur.long;
    var urLat = query.ur.lat;
    var zoom = query.zoom;
    if (blLong && blLat && urLong && urLat && zoom) {
      next();
      return;
    }
  }
  res.status(400).json({
    err: new Error('Need bbox bottom left and upper right corners, as longitude[long] and latitude[lat], all as numbers!')
  });
};

/**
 * Using this route, groups elems are cropped out (all elems) if there are > 5 elems in group. Only count will be available, and geohash resolution for further requests.
 * @see Test URL - http://localhost:3000/geo?bl[long]=37.420806884765625&bl[lat]=55.68997171381322&ur[long]=37.82180786132812&ur[lat]=55.814400697400515
 */
router.get('/', validate, function(req, res, next) {
  var bottomLeft = [parseFloat(req.query.bl.long), parseFloat(req.query.bl.lat)];
  var upperRight = [parseFloat(req.query.ur.long), parseFloat(req.query.ur.lat)];
  var zoom = parseInt(req.query.zoom);

  var queryData = constructQuery(bottomLeft, upperRight, zoom, true);

  mongo.collection
    .aggregate(queryData.query)
    .toArray(function(err, groups){
      res.status(err ? 400 : 200).json({
        err: err,
        groupies: groups,
        groupsCount: groups ? groups.length : 0,
        queryData: _.extend(
          _.reject(queryData, function(v, k){ return k === 'query'; }),
          { coordinates: [bottomLeft, upperRight] }
        )
      })
    });
});

/**
 * Using this route, back-end (this node.js app) will manually crop the arrays inside groups if they are > 5 elems.
 * @see Test URL - http://localhost:3000/geo/manual?bl[long]=37.420806884765625&bl[lat]=55.68997171381322&ur[long]=37.82180786132812&ur[lat]=55.814400697400515
 */
router.get('/manual', validate, function(req, res, next){
  var bottomLeft = [parseFloat(req.query.bl.long), parseFloat(req.query.bl.lat)];
  var upperRight = [parseFloat(req.query.ur.long), parseFloat(req.query.ur.lat)];
  var zoom = parseInt(req.query.zoom);

  var queryData = constructQuery(bottomLeft, upperRight, zoom);

  mongo.collection
    .aggregate(queryData.query)
    .toArray(function(err, groups){
      groups = _.map(groups, function(group){
        group.pointsData = _.sample(group.pointsData, 5);
        return group;
      });
      res.status(err ? 400: 200).json({
        err: err,
        groupies: groups,
        groupsCount: groups ? groups.length : 0,
        queryData: _.extend(
          _.reject(queryData, function(v, k){ return k === 'query'; }),
          { coordinates: [bottomLeft, upperRight] }
        )
      })
    });

});

module.exports = router;
