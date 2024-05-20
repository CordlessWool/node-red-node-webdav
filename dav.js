module.exports = function (RED) {
  const dav = require('dav')
  const IcalExpander = require('ical-expander')
  const moment = require('moment')

  function CalDav (config) {
    RED.nodes.createNode(this, config)
    this.server = RED.nodes.getNode(config.server)
    this.calendar = config.calendar
    this.pastWeeks = config.pastWeeks || 0
    this.futureWeeks = config.futureWeeks || 4
    const node = this

    node.on('input', (msg) => {
      const startDate = moment().startOf('day').subtract(this.pastWeeks, 'weeks')
      const endDate = moment().endOf('day').add(this.futureWeeks, 'weeks')
      const filters = [{
        type: 'comp-filter',
        attrs: { name: 'VCALENDAR' },
        children: [{
          type: 'comp-filter',
          attrs: { name: 'VEVENT' },
          children: [{
            type: 'time-range',
            attrs: {
              start: startDate.format('YYYYMMDD[T]HHmmss[Z]'),
              end: endDate.format('YYYYMMDD[T]HHmmss[Z]')
            }
          }]
        }]
      }]
      // dav.debug.enabled = true;
      const xhr = new dav.transport.Basic(
        new dav.Credentials({
          username: node.server.credentials.user,
          password: node.server.credentials.pass
        })
      )
      // Server + Basepath
      let calDavUri = node.server.address + '/remote.php/dav/calendars/'
      // User
      calDavUri += node.server.credentials.user + '/'
      dav.createAccount({ server: calDavUri, xhr: xhr, loadCollections: true, loadObjects: true })
        .then(function (account) {
          if (!account.calendars) {
            node.error('Nextcloud:CalDAV -> no calendars found.')
            return
          }
          // account instanceof dav.Account
          account.calendars.forEach(function (calendar) {
            // Wenn Kalender gesetzt ist, dann nur diesen abrufen
            const calName = msg.calendar || node.calendar
            if (!calName || !calName.length || (calName && calName.length && calName === calendar.displayName)) {
              dav.listCalendarObjects(calendar, { xhr: xhr, filters: filters })
                .then(function (calendarEntries) {
                  const msg = { payload: { name: calendar.displayName, data: [] } }
                  calendarEntries.forEach(function (calendarEntry) {
                    try {
                      const ics = calendarEntry.calendarData
                      const icalExpander = new IcalExpander({ ics, maxIterations: 100 })
                      const events = icalExpander.between(startDate.toDate(), endDate.toDate())
                      msg.payload.data = msg.payload.data.concat(convertEvents(events))
                    } catch (error) {
                      node.error('Error parsing calendar data: ' + error)
                    }
                  })
                  node.send(msg)
                }, function () {
                  node.error('Nextcloud:CalDAV -> get ics went wrong.')
                })
            }
          })
        }, function () {
          node.error('Nextcloud:CalDAV -> get calendars went wrong.')
        })
    })

    function convertEvents (events) {
      const mappedEvents = events.events.map(_convertEvent)
      const mappedOccurrences = events.occurrences.map(_convertEvent)
      return [].concat(mappedEvents, mappedOccurrences)
    }

    function _convertEvent (e) {
      if (e) {
        const startDate = e.startDate.toString()
        const endDate = e.endDate.toString()

        if (e.item) {
          e = e.item
        }
        if (e.duration.wrappedJSObject) {
          delete e.duration.wrappedJSObject
        }

        return {
          startDate: startDate,
          endDate: endDate,
          summary: e.summary || '',
          description: e.description || '',
          attendees: e.attendees,
          duration: e.duration.toICALString(),
          durationSeconds: e.duration.toSeconds(),
          location: e.location || '',
          organizer: e.organizer || '',
          uid: e.uid || '',
          isRecurring: false,
          allDay: ((e.duration.toSeconds() % 86400) === 0)
        }
      }
    }
  }
  RED.nodes.registerType('caldav', CalDav)

  function CardDav (config) {
    RED.nodes.createNode(this, config)
    this.server = RED.nodes.getNode(config.server)
    this.addressBook = config.addressBook
    const node = this

    node.on('input', (msg) => {
      const xhr = new dav.transport.Basic(
        new dav.Credentials({
          username: node.server.credentials.user,
          password: node.server.credentials.pass
        })
      )

      // Server + Basepath
      let cardDavUri = node.server.address + '/remote.php/dav/addressbooks/users/'
      // User
      cardDavUri += node.server.credentials.user + '/'
      // ToDo Filter ?
      dav.createAccount({ server: cardDavUri, xhr: xhr, accountType: 'carddav' })
        .then(function (account) {
          if (!account.addressBooks) {
            node.error('Nextcloud:CardDAV -> no addressbooks found.')
            return
          }
          // account instanceof dav.Account
          account.addressBooks.forEach(function (addressBook) {
            // Wenn Adressbuch gesetzt ist, dann nur diesen abrufen
            const c = msg.addressBook || node.addressBook
            if (!c || !c.length || (c && c.length && c === addressBook.displayName)) {
              dav.listVCards(addressBook, { xhr: xhr })
                .then(function (addressBookEntries) {
                  const vcfList = { payload: { name: addressBook.displayName, data: [] } }
                  addressBookEntries.forEach(function (addressBookEntry) {
                    const keyValue = addressBookEntry.addressData.split('\n')
                    const vcfJson = {}
                    for (let x = 0; x < keyValue.length; x++) {
                      const temp = keyValue[x].split(':')
                      vcfJson[temp[0]] = temp[1]
                    }
                    vcfList.payload.data.push(vcfJson)
                  })
                  node.send(vcfList)
                }, function () {
                  node.error('Nextcloud:CardDAV -> get cards went wrong.')
                })
            }
          })
        }, function () {
          node.error('Nextcloud:CardDAV -> get addressBooks went wrong.')
        })
    })
  }
  RED.nodes.registerType('carddav', CardDav)
}
