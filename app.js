
/**
 * Module dependencies.
 */

 var config = global.config = require('./config')
    , express = require('express')
    , routes = require('./routes')
    , user = require('./routes/user')
    , auth = require('./routes/auth')
    , picasa = require('./routes/picasa')
    , http = require('http')
    , path = require('path')
    , passport = require('passport')
    , GoogleStrategy = require('passport-google-oauth').OAuth2Strategy
    , inspect = require("eyes").inspector();

// var _oldAuthorizationParams = GoogleStrategy.authorizationParams;
// GoogleStrategy.authorizationParams = function (options) {
//     var params = _oldAuthorizationParams(options);
//     params.access_type = "offline";
//     params.approval_prompt = "force";
//     return params;
// };

////////////////////////////////////////////////////////////////////////////////
// Passport
passport.use(new GoogleStrategy(
    config.googleOAuthDetails,
    function(accessToken, refreshToken, profile, done) {
        //User.findOrCreate({ googleId: profile.id }, function (err, user) {
        delete profile._raw;
        delete profile._json;
        var user = {
            profile: profile,
            accessToken: accessToken,
            refreshToken: refreshToken
        };
        inspect(user);
        return done(null, user);

        //});
    }
));

passport.serializeUser(function(user, done) {
    done(null, serializeUserToJSON(user));
});

function serializeUserToJSON(user) {
    return JSON.stringify(user);
}

passport.deserializeUser(function(serialized, done) {
    //console.log("deserialize " + id);
    //db.getUserById(id, function (err, user) {
        done(null, JSON.parse(serialized));
    //});
});


////////////////////////////////////////////////////////////////////////////////
// Express config

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.compress());

app.use(express.bodyParser());

// middleware: intercept the response just before headers are sent and
// reserialize the user object back into the session.
// this is needed because we don't have any other backing store for users
app.use(function (req, res, next) {
    res.on('header', function () {
        if (!(req.user && req.session)) return;
        var ser = serializeUserToJSON(req.user);
        var key = passport._key;
        req.session[key] = req.session[key] || {};
        req.session[key].user = ser;
    });
    next();
});

app.use(express.cookieParser(config.cookieSecret));
app.use(express.cookieSession({secret: config.sessionSecret}));

app.use(passport.initialize());
app.use(passport.session());

// csrf??

app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));


// development only
if ('development' == app.get('env')) {
    app.use(express.errorHandler());
    app.locals.pretty = true;
}



////////////////////////////////////////////////////////////////////////////////
// routes

app.get('/', routes.index);
app.get('/users', user.list);

app.get('/auth/login', auth.login);
app.post('/auth/login', passport.authenticate('local', { successRedirect: '/',
                                                    failureRedirect: '/login' }));

app.get('/auth/google',
  passport.authenticate('google', {
    scope: 'openid profile email https://picasaweb.google.com/data/',
    accessType: "offline",
    approvalPrompt: "force"
}));
// app.get('/auth/google/return',
//     passport.authenticate('google', { successRedirect: '/',
//                                       failureRedirect: '/auth/login' }));

app.get('/auth/google/return',
    passport.authenticate('google', { failureRedirect: '/auth/fail' }),
    function(req, res) {
        // Successful authentication, redirect home.
        res.redirect('/picasa');
    }
);

app.get("/auth/fail", auth.fail);
app.get("/auth/success", auth.success);


app.get('/picasa', picasa.getAlbums);
app.get('/picasa/:albumid', picasa.getAlbum);


http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});


