/////////////////////////////////////////////////////////////////////
// Viewing.Extension.A360View
// by Philippe Leefsma, Feb 2016
//
/////////////////////////////////////////////////////////////////////
import JSONView from 'jquery-jsonview/dist/jquery.jsonview'
import 'jquery-jsonview/dist/jquery.jsonview.css'
import {HierarchyTreeDelegate} from './Hierarchy'
import {ExportsTreeDelegate} from './Exports'
import 'jsoneditor/dist/jsoneditor.min.css'
import EventsEmitter from 'EventsEmitter'
import {Formats, Payloads} from './data'
import UIComponent from 'UIComponent'
import TabManager from 'TabManager'
import DerivativesAPI from '../API'
import JSONEditor from 'jsoneditor'
import Dropdown from 'Dropdown'
import './ManagerPanel.scss'

export default class DerivativesManagerPanel extends UIComponent {

  ///////////////////////////////////////////////////////////////////
  //
  //
  ///////////////////////////////////////////////////////////////////
  constructor (apiUrl = '/api/derivatives') {

    super()

    this.domElement = document.createElement('div')

    this.domElement.classList.add('derivatives')

    this.derivativesAPI = new DerivativesAPI({
      apiUrl
    })

    this.apiUrl = apiUrl
  }

  ///////////////////////////////////////////////////////////////////
  //
  //
  ///////////////////////////////////////////////////////////////////
  initialize (container, appContainer) {

    $(container).append(this.domElement)

    this.appContainer = appContainer

    this.TabManager = new TabManager(
      this.domElement)

    // API missing formats for dwf
    // using hardcoded version for now
    //this.derivativesAPI.getFormats().then((res) => {
    //
    //  this.formats = formats
    //})

    this.formats = Formats

    this.createManifestTab()

    this.createHierarchyTab()

    this.createExportsTab()
  }

  ///////////////////////////////////////////////////////////////////
  //
  //
  ///////////////////////////////////////////////////////////////////
  load (urn) {

    this.urn = urn

    return Promise.all([
      this.loadHierarchy(urn),
      this.loadManifest(urn),
      this.loadExports(urn)
    ])
  }

  ///////////////////////////////////////////////////////////////////
  //
  //
  ///////////////////////////////////////////////////////////////////
  createManifestTab () {

    const btnShowInTabId = this.guid()

    const btnDeleteId = this.guid()

    this.TabManager.addTab({
      name: 'Manifest',
      active: true,
      html: `
        <div class="derivatives-tab-container manifest">
          <div class="json-view">
          </div>
          <div class="controls">
            <button id="${btnShowInTabId}" class="btn">
              <span class="glyphicon glyphicon-share-alt">
              </span>
              Show in new tab ...
            </button>
            <br/>
            <button id="${btnDeleteId}" class="btn">
              <span class="glyphicon glyphicon-remove">
              </span>
              Delete manifest
            </button>
          </div>
       </div>`
    })

    $('#' + btnShowInTabId).click(() => {

      const uri = `${this.apiUrl}/manifest/${this.urn}`

      this.showPayload(uri)
    })

    $('#' + btnDeleteId).click(() => {

      $(`.json-view`).JSONView({
        message: 'No manifest on this item'
      })

      $('.manifest .controls').css({
        display: 'none'
      })

      this.emit('manifest.delete', this.urn)

      this.derivativesAPI.deleteManifest(this.urn)
    })
  }

  ///////////////////////////////////////////////////////////////////
  //
  //
  ///////////////////////////////////////////////////////////////////
  loadManifest (urn) {

    return new Promise((resolve) => {

      this.derivativesAPI.getManifest(
        urn).then((manifest) => {

          $(`.json-view`).JSONView(manifest, {
            collapsed: false
          })

          $('.manifest .controls').css({
            display: 'block'
          })

          resolve()

        }, (error) => {

          $(`.json-view`).JSONView({
            message: 'No manifest on this item'
          })

          $('.manifest .controls').css({
            display: 'none'
          })

          resolve()
        })
    })
  }

  ///////////////////////////////////////////////////////////////////
  //
  //
  ///////////////////////////////////////////////////////////////////
  createHierarchyTab () {

    const btnShowInTabId = this.guid()

    this.TabManager.addTab({
      name: 'Hierarchy',
      html: `
        <div class="derivatives-tab-container hierarchy">
          <div class="hierarchy-tree">
          </div>
          <div class="controls">
            <button id="${btnShowInTabId}" class="btn">
              <span class="glyphicon glyphicon-share-alt">
              </span>
              Show in new tab ...
            </button>
          </div>
        </div>`
    })

    $('#' + btnShowInTabId).click(() => {

      const uri = `${this.apiUrl}/hierarchy/` +
        `${this.urn}/${this.modelGuid}`

      this.showPayload(uri)
    })
  }

  ///////////////////////////////////////////////////////////////////
  //
  //
  ///////////////////////////////////////////////////////////////////
  loadHierarchy (urn) {

    return new Promise(async(resolve) => {

      try {

        $('.hierarchy-tree').empty()

        $('.hierarchy .controls').css({
          display: 'none'
        })

        const metadataResponse = await this.derivativesAPI.getMetadata(
          this.urn)

        const metadata = metadataResponse.data.metadata

        if (metadata && metadata.length) {

          this.modelGuid = metadata[0].guid

          const hierarchy = await this.derivativesAPI.getHierarchy(
            this.urn, this.modelGuid)

          const properties = await this.derivativesAPI.getProperties(
            this.urn, this.modelGuid)

          if(hierarchy.data && properties.data) {

            const delegate = new HierarchyTreeDelegate(
              hierarchy.data,
              properties.data.collection)

            delegate.on('node.dblClick', (node) => {

              const propertyPanel = new DerivativesPropertyPanel(
                this.appContainer,
                node.name + ' Properties',
                node.properties)

              propertyPanel.setVisible(true)
            })

            const rootNode = {
              name: 'Model Hierarchy',
              type: 'hierarchy.root',
              id: this.guid(),
              group: true
            }

            // ensure no double requests populate UI
            $('.hierarchy-tree').empty()

            const domContainer = $('.hierarchy-tree')[0]

            new Autodesk.Viewing.UI.Tree(
              delegate, rootNode, domContainer, {
                excludeRoot: false
              })

            $('.hierarchy .controls').css({
              display: 'block'
            })
          }
        }

        resolve()

      } catch (ex) {

        console.log(ex)
        resolve()
      }
    })
  }

  ///////////////////////////////////////////////////////////////////
  //
  //
  ///////////////////////////////////////////////////////////////////
  createExportsTab () {

    const btnPostJobId = this.guid()

    this.TabManager.addTab({
      name: 'Exports',
      html: `
        <div class="derivatives-tab-container exports">
           <div class="exports-tree">

           </div>
           <div class="exports-formats">

           </div>
           <div class="exports-payload">

           </div>
           <button id="${btnPostJobId}" class="btn btn-post-job">
              <span class="glyphicon glyphicon-cloud-upload">
              </span>
              Post job ...
            </button>
       </div>`
    })

    this.formatsDropdown = new Dropdown({
      container: '.exports-formats',
      title: 'Export format',
      prompt: 'Select an export format ...',
      pos: {
        top: 0, left: 0
      },
      menuItems: []
    })

    this.formatsDropdown.on('item.selected', (item) => {

      this.editor.set(Payloads[item.name])
    })

    this.editor = new JSONEditor($('.exports-payload')[0], {
      search: false
    })

    const defaultPayload = {
      input: {},
      output: {}
    }

    this.editor.set(defaultPayload)

    this.editor.expandAll()

    $('#' + btnPostJobId).click(() => {

    })
  }

  ///////////////////////////////////////////////////////////////////
  //
  //
  ///////////////////////////////////////////////////////////////////
  loadExports (urn) {

    return new Promise(async(resolve) => {

      $('.exports-tree').empty()

      $('.exports').css({
        display: 'block'
      })

      const fileType = window.atob(urn).split(".").pop(-1)

      let supportedFormats = []

      for(var format in this.formats) {

        if (this.formats[format].indexOf(fileType) > -1) {

          supportedFormats.push(format)
        }
      }

      const delegate = new ExportsTreeDelegate(
        urn,
        supportedFormats,
        this.derivativesAPI)

      const domContainer = $('.exports-tree')[0]

      const rootNode = {
        name: 'Available Export Formats',
        type: 'formats.root',
        id: this.guid(),
        group: true
      }

      new Autodesk.Viewing.UI.Tree(
        delegate, rootNode, domContainer, {
          excludeRoot: false
        })

      this.formatsDropdown.setItems(

        supportedFormats.map((format) => {
          return {
           name: format
          }
        }), -1
      )

      resolve()
    })
  }
}

///////////////////////////////////////////////////////////////////////////////
//
//
///////////////////////////////////////////////////////////////////////////////
class DerivativesPropertyPanel extends Autodesk.Viewing.UI.PropertyPanel {

  constructor (container, title, properties) {

    super (container, UIComponent.guid(), title)

    this.setProperties(properties)
  }

  /////////////////////////////////////////////////////////////
  // initialize override
  //
  /////////////////////////////////////////////////////////////
  initialize() {

    super.initialize()

    this.container.classList.add('derivatives')
  }

  /////////////////////////////////////////////////////////////
  // createTitleBar override
  //
  /////////////////////////////////////////////////////////////
  createTitleBar (title) {

    var titleBar = document.createElement("div")

    titleBar.className = "dockingPanelTitle"

    this.titleTextId = this.guid()

    this.titleImgId = this.guid()

    var html = `
      <img id="${this.titleImgId}"></img>
      <div id="${this.titleTextId}" class="dockingPanelTitleText">
        ${title}
      </div>
    `

    $(titleBar).append(html)

    this.addEventListener(titleBar, 'click', (event)=> {

      if (!this.movedSinceLastClick) {

        this.onTitleClick(event)
      }

      this.movedSinceLastClick = false
    })

    this.addEventListener(titleBar, 'dblclick', (event) => {

      this.onTitleDoubleClick(event)
    })

    return titleBar
  }

  /////////////////////////////////////////////////////////////
  // setTitle override
  //
  /////////////////////////////////////////////////////////////
  setTitle (text, options) {

    if (options && options.localizeTitle) {

      $(`#${this.titleTextId}`).attr('data-i18n', text)

      text = Autodesk.Viewing.i18n.translate(text)

    } else {

      $(`#${this.titleTextId}`).removeAttr('data-i18n')
    }

    $(`#${this.titleTextId}`).text(text)
  }

  ///////////////////////////////////////////////////////////////////
  //
  //
  ///////////////////////////////////////////////////////////////////
  guid(format = 'xxxxxxxxxx') {

    var d = new Date().getTime()

    var guid = format.replace(
      /[xy]/g,
      function (c) {
        var r = (d + Math.random() * 16) % 16 | 0
        d = Math.floor(d / 16)
        return (c == 'x' ? r : (r & 0x7 | 0x8)).toString(16)
      })

    return guid
  }
}