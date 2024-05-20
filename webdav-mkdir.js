const { createClient } = require('webdav')
const https = require('https')
const path = require('path')

module.exports = function (RED) {
  function WebDavDirectory (config) {
    RED.nodes.createNode(this, config)
    this.server = RED.nodes.getNode(config.server)
    this.directory = config.directory
    const node = this

    function createParentDirectories (client, directory, option) {
      const parentDir = path.dirname(directory)
      return client.createDirectory(parentDir, option)
        .catch(error => {
          if (error.response && error.response.status === 405) { // Directory already exists
            return Promise.resolve()
          }
          throw error
        })
    }

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

      // check option for self-signed certs
      const option = {}
      if (node.server.insecure) {
        option.httpsAgent = new https.Agent({ rejectUnauthorized: false })
      }

      createParentDirectories(client, directory, option)
        .then(() => {
          return client.createDirectory(directory, option)
            .then(function (contents) {
              node.send({
                ...msg,
                payload: contents
              })
            })
        })
        .catch(function (error) {
          node.error(error.toString(), msg)
        })
    })
  }

  RED.nodes.registerType('webdav-mkdir', WebDavDirectory)
}
