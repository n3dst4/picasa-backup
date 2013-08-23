var request = require('request')
    , inspect = require("eyes").inspector({maxLength: 0})
    , xml2js = require('xml2js')
    , _ = require('underscore')
    , url = require('url')
    , request = require("request")
    , fs = require("fs")
    , guid = require("guid")
    , knox = require("knox")
    , parseString = require('xml2js').parseString
    , async = require("async")
    , config = global.config;



////////////////////////////////////////////////////////////////////////////////
// S3 Setup

var awsKey = config.awsKey;
var awsSecret = config.awsSecret;
var awsBucket = config.awsBucket;

// var AWS = require('aws-sdk');
// AWS.config.update({
//     accessKeyId: awsKey,
//     secretAccessKey: awsSecret
// });
// var s3 = new AWS.S3();

// s3.createBucket({Bucket: 'myBucket'}, function() {
//     var params = {Bucket: 'myBucket', Key: 'myKey', Body: 'Hello!'};
//     s3.putObject(params, function(err, data) {
//     if (err)
//         console.log(err)
//     else
//         console.log("Successfully uploaded data to myBucket/myKey");
//     });
// });

var knoxClient = knox.createClient({
    key: awsKey,
    secret: awsSecret,
    bucket: awsBucket
});

var queue = async.queue(backup, 10);

queue.drain = function(){ console.log("queue empty"); };


////////////////////////////////////////////////////////////////////////////////


var contentDispRe = /filename="([^"]+)"/;



exports.getAlbums = function (req, res, next) {
    //inspect(req);
    var token = req.user.accessToken;
    var id = req.user.profile.id;
    var url = "https://picasaweb.google.com/data/feed/api/user/" + id + "?thumbsize=160c";
    //url = "https://www.google.com/";
    //console.log("TOKEN: " +  token);

    request.get({url: url, headers: { "Authorization": "Bearer " + token} },
        function(error, response, body){
        //inspect(response);
        if (error) return next(error);

        parseString(body, function (err, result) {
            if (! (result && result.feed && result.feed.entry && result.feed.entry.length)) {
                return next("Error retrieving feed");
            }
            var albums = _(result.feed.entry).map(function(entry){
                return {
                    title: entry.title[0]._,
                    id: entry["gphoto:id"][0],
                    thumbnail: {
                        url: entry["media:group"][0]["media:thumbnail"][0].$.url,
                        width: entry["media:group"][0]["media:thumbnail"][0].$.width,
                        height: entry["media:group"][0]["media:thumbnail"][0].$.url
                    }
                };
            });
            //inspect(albums);
            res.render("albums", {albums: albums});
        });
    });
    //res.send("okay");
};


exports.getAlbum = function (req, res) {
    var albumId = req.params.albumid;
    var token = req.user.accessToken;
    var userId = req.user.profile.id;
    //see https://developers.google.com/picasa-web/docs/2.0/reference#Parameters
    var url = "https://picasaweb.google.com/data/feed/api/user/" + userId +
        "/albumid/" + albumId + "?thumbsize=160c,1600u&imgmax=d";
    request.get({url: url, headers: { "Authorization": "Bearer " + token} },
        function(error, response, body){
        if (error) return res.send(error);
        parseString(body, function (err, result) {
            var title = result.feed.title[0]._;
            var photos = _(result.feed.entry).map(function(entry){
                return {
                    title: entry.title[0]._,
                    id: entry["gphoto:id"][0],
                    src: entry["media:group"][0]["media:thumbnail"][1].$.url,
                    downloadUrl: entry.content[0].$.src,
                    caption: entry.summary[0]._,
                    thumbnail: {
                        url: entry["media:group"][0]["media:thumbnail"][0].$.url,
                        width: entry["media:group"][0]["media:thumbnail"][0].$.width,
                        height: entry["media:group"][0]["media:thumbnail"][0].$.height
                    }
                };
            });
            //inspect(albums);

            process.nextTick(function () {
                if (photos.length == 0) return;
                for (var i in photos) {
                    queue.push({
                        src: photos[i].downloadUrl,
                        title:photos[i].title,
                        caption: photos[i].caption || "",
                        userId: req.user.profile.id,
                        userType: "google"
                    });
                }
            });

            res.render("photos", {title: title, photos: photos});

        });
    });
};



function getFilenameFromContDisp(orig) {
    var match = contentDispRe.exec(orig);
    if (match == null) return null;
    return match[1];
}



function backup (details, callback) {
    //src, title, caption, userId, userType
    //var deferred = Q.defer();
    request.head(details.src, function (err, res) {
        var filename = getFilenameFromContDisp(
            res.headers["content-disposition"]) || "file";
        filename = "/" + details.userType + "/" + details.userId + "/" + filename + "-" + guid.raw();
        var headers = {
            'Content-Length': res.headers['content-length'],
            'Content-Type': res.headers['content-type'],
            "x-amz-meta-caption": details.caption || ""
        };
        var putReq =  knoxClient.put(filename, headers);
        request.get(details.src).pipe(putReq);
        putReq.on('response', function(res){
            console.log("Saved " + res.req.path );
            callback();
            //deferred.resolve();
        });
    });
    //return deferred.promise;
}