class VersionChecker {
  latest () {
    return fetch(
      'https://api.github.com/repos/thisishappenin/idle-break/releases/latest',
      {
        method: 'GET',
        headers: { 'User-Agent': 'thisishappenin/idle-break' },
        mode: 'cors',
        cache: 'default'
      })
      .then(response => response.text())
      .then(body => JSON.parse(body).tag_name)
      .catch(() => {})
  }
}

export default VersionChecker
