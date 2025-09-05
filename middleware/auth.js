function requireAuth(req, res, next) {
  if (req.session.authenticated) {
    return next();
  }
  
  if (req.get('Accept') === 'text/plain') {
    return res.status(401).send('ERROR: Authentication required');
  }
  
  res.redirect('/login');
}

module.exports = {
  requireAuth
};
