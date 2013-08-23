exports.fail = function (req, res) {
    res.render("auth-fail");
};

exports.success = function (req, res) {
    res.render("auth-success");
};

exports.login =  function (req, res) {
    res.render('login', {  });
};