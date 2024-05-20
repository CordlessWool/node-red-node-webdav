const { createClient } = require('webdav')
const https = require('https')

module.exports = function (RED) {
  function WebDavList (config) {
    RED.nodes.createNode(this, config)
    this.server = RED.nodes.getNode(config.server)
    this.directory = config.directory
    const node = this

    node.on('input', (msg) => {
      const webDavUri = node.server.address
      const client = createClient(webDavUri, {
        username: node.server.credentials.user,
        password: node.server.credentials.pass
      })
      let directory = ''
      if (msg.directory) {
        directory = '/' + msg.directory
      } else if (node.directory && node.directory.length) {
        directory = '/' + node.directory
      }
      directory = directory.replace('//', '/')

      // check option for self signed certs
      const option = {}
      if (node.server.insecure) {
        option.httpsAgent = new https.Agent({ rejectUnauthorized: false })
      }
      client.getDirectoryContents(directory, option)
        .then(function (contents) {
          node.send({
            ...msg,
            payload: contents
          })
        }, function (error) {
          node.error(error.toString(), msg)
        })
    })
  }

  RED.nodes.registerType('webdav-list', WebDavList)
}
