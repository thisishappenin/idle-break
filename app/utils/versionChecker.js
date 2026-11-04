class VersionChecker {
  latest () {
    return fetch(
      'https://api.github.com/repos/thisishappenin/stretchly/releases/latest',
      {
        method: 'GET',
        headers: { 'User-Agent': 'thisishappenin/stretchly' },
        mode: 'cors',
        cache: 'default'
      })
      .then(response => response.text())
      .then(body => JSON.parse(body).tag_name)
      .catch(() => {})
  }
}

export default VersionChecker
