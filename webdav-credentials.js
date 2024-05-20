module.exports = function (RED) {
  function WebdavConfigNode (config) {
    RED.nodes.createNode(this, config)
    this.address = config.address + '/' + config.basePath
    this.basePath = config.basePath
    this.address = this.address.replace('//', '/')
    this.insecure = config.insecure
  }

  RED.nodes.registerType('webdav-credentials', WebdavConfigNode, {
    credentials: {
      user: { type: 'text' },
      pass: { type: 'password' }
    }
  })
}
