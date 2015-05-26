/**
 * Created by Ravis on 26/05/15.
 */

angular.module('geo-clustering', ['uiGmapgoogle-maps'])
  .config(['uiGmapGoogleMapApiProvider', function(uiGmapGoogleMapApiProvider) {
    uiGmapGoogleMapApiProvider.configure({
      //    key: 'your api key',
      v: '3.17',
      libraries: 'weather,geometry,visualization'
    });
  }])
  .controller('MapController', function($scope, $http, uiGmapGoogleMapApi){
    $scope.backEndCropping = false;
    $scope.switchCroppingVariant = function(){
      $scope.backEndCropping = !$scope.backEndCropping;
      runQuery();
    };

    var runQuery = function(){
      var GMap = $scope.map.control.getGMap();
      var mapBounds = GMap.getBounds();
      var sw = mapBounds.getSouthWest();
      var ne = mapBounds.getNorthEast();
      var path = '/geo' + ($scope.backEndCropping ? '/manual?' : '?');
      var query = 'bl[long]='+sw.lng()+
        '&bl[lat]='+sw.lat()+
        '&ur[long]='+ne.lng()+
        '&ur[lat]='+ne.lat()+
        '&zoom='+GMap.getZoom();
      console.log('Performing query: ', query);
      $http.get(path + query)
        .success(setNewResult)
        .error(function(data, status){
          console.error('Error requesting geo-data:', data, status);
          setNewResult(data);
        });
    };
    $scope.map = {
      center: [37.62199401855469, 55.752622242389236],
      zoom: 10,
      bounds: {},
      control: {},
      events: {
        dragend: runQuery,
        zoom_changed: runQuery
      },
      markers: [],
      lastQuery: null
    };
    $scope.markerClicked = function(marker){
      marker.showWindow = true;
      $scope.$apply();
    };
    var setNewResult = function(data){
      for (var i = 0; i < data.groupsCount; i++) {
        var groupie = data.groupies[i];
        groupie.id = groupie._id;
        if (groupie.count === 1){
          groupie.loc = groupie.pointsData[0].coordinates;
          groupie.exactPlace = true;
        }else{
          var tmpLoc = decodeGeoHash(groupie._id);
          groupie.loc = [tmpLoc.latitude[2], tmpLoc.longitude[2]];
        }
        groupie.longitude = groupie.loc[0];
        groupie.latitude = groupie.loc[1];
      }
      $scope.map.markers = data.groupies;
      $scope.map.lastQuery = _.reject(data, function(v,k){return k === 'pointsData'});
      console.log('Markers data:', data);
    };

    uiGmapGoogleMapApi.then(function(maps) {
      console.log('Maps ready:', maps);
    })
  });