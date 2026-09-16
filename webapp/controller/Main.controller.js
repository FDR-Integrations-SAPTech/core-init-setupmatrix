sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], (Controller, Fragment, JSONModel, MessageToast, MessageBox) => {
    "use strict";

    return Controller.extend("zppsetupmatrix.controller.Main", {
        onInit() {
        },

        onFileAdded: function () {
            this.byId("uploadBtn").setEnabled(true);
            this.byId("excelUploadSet").setEnabled(false);
        },
       
        onUploadTrigger: function () {
            var oUploadSet = this.getView().byId("excelUploadSet");
            var aItems = oUploadSet.getIncompleteItems();
            debugger;
            if (aItems.length > 0) {
                var oFileToUpload = aItems[0].getFileObject();
                var oModel = this.getView().getModel();

                // FALLBACK: If getFileObject() is null/blank, extract it from the internal item properties
                if (!oFileToUpload && oUploadSetItem._oFileObject) {
                    oFileToUpload = oUploadSetItem._oFileObject;
                } else if (!oFileToUpload && oUploadSetItem.getProperty("fileObj")) {
                    oFileToUpload = oUploadSetItem.getProperty("fileObj");
                }

                // 2. Safety Check: If it's still missing, the browser cannot find the binary stream
                if (!oFileToUpload) {
                    sap.m.MessageToast.show("Fatal error: HTML5 File Reference is missing or unreadable.");
                    return;
                }
                var oReader = new FileReader();
                oReader.onload = function (e) {
                    var sRawResult = e.target.result;

                    // 2. Strip out the data type prefix (e.g., "data:application/vnd.ms-excel;base64,")
                    var sBase64Content = sRawResult.split(",")[1];

                    // 3. Prepare the action payload matching your Abstract Entity
                    var oActionPayload = {
                        "Filename": oFileToUpload.name,
                        "MimeType": oFileToUpload.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        "Attachment": sBase64Content
                    };

                    this._callRAPAction(oActionPayload, oUploadSet);

                }.bind(this);

                oReader.readAsDataURL(oFileToUpload);
            } else {
                MessageToast.show("Please select a file to upload first.");
            }
        },

        /**
         * /**
         * Dispatches the action call to the RAP Service
         */
        _callRAPAction: function (oPayload, oUploadSet) {
            var oModel = this.getView().getModel();

            // Adjust the URL pattern below based on your entity and action names:
            // For Bound Action: /EntitySet(key='value')/ServiceBinding.actionName
            // For Unbound Action: /ServiceBinding.actionName
            var sActionPath = "/uploadExcel(...)";
            var oEntitySetContext = oModel.bindContext("/uploadMidMatrix").getBoundContext();

            // 2. Bind the action RELATIVE to that collection context.
            var sActionName = "com.sap.gateway.srvd.zppsd_setup_matrix.v0001.uploadExcel(...)";
            var oActionBinding = oModel.bindContext(sActionName, oEntitySetContext);

            // Check if OData V4 is being used
            if (oModel.bindContext) {
                var oOperation = oModel.bindContext(sActionName, oEntitySetContext);
                oOperation.setParameter("Filename", oPayload.Filename);
                oOperation.setParameter("MimeType", oPayload.MimeType);
                oOperation.setParameter("Attachment", oPayload.Attachment);
                // Execute the deferred pipeline action safely
                oOperation.execute().then(function () {
                    sap.m.MessageToast.show("File processed successfully by RAP action pipeline.");
                    oUploadSet.removeAllIncompleteItems();
                    this.byId("uploadBtn").setEnabled(false);
                    var oResultContext = oOperation.getBoundContext();
                    if (oResultContext && oResultContext.getObject()) {
                        var aReturnedRows = oResultContext.getObject().value; // Array of ZD_UploadResult items
                        // 2. Set the array into a localized JSON model for the Dialog
                        var oLocalModel = new sap.ui.model.json.JSONModel({
                            items: aReturnedRows
                        });
                        this.getView().setModel(oLocalModel, "resultModel");

                        // 3. Load and open the dialog fragment safely
                        if (!this._pResultDialog) {
                            this._pResultDialog = Fragment.load({
                                id: this.getView().getId(),
                                name: "zppsetupmatrix.view.fragments.uploadResultDialog",
                                controller: this
                            }).then(function (oDialog) {
                                this.getView().addDependent(oDialog);
                                return oDialog;
                            }.bind(this));
                        }

                        this._pResultDialog.then(function (oDialog) {
                            oDialog.open();
                        });
                    }
                }.bind(this)).catch(function (oError) {
                    sap.m.MessageBox.error("Action execution failed: " + oError);
                });
            }
        },

        // / Event Handler to close the dialog 
        onCloseResultDialog: function ( ) 
        {
            var oDialog = this.byId("resultDialog");
            if (oDialog) {
                oDialog.close();
            }
        }
    });

    
});