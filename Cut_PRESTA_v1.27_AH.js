//@title Cut Creator from PreSta v1.27
// @description CutContour generator for print technologies using the cutting contour, such as die-cut, laser-cut, etc.
// Generates a cut contour shape (rectangle or ellipse) on a dedicated "CutContour" layer, optionally combined with a positioned hanging hole.
// Automatically keeps the artwork, finishing/varnish/gold and white layers separated and stacked in the correct order.
// Offers to export the current document as a print-ready PDF (PDF/X-4 preset) into an "Out" folder on the Desktop, named after the document itself.
// @author Iurie Olaru
// @version 1.27
// @affinity 3.2.+
// @verified 
// @homepage 
// @github https://github.com/IuFeov/PRESTA-for-Affinity
// @tags prepress, utility, cut contour, cut contour creator, cut contour generator, cut contour script, cut contour plugin, cut contour extension
// @image 

/* ============================================================================
 *  CutContour  —  v1.27 - PRESTA
 *  Script per Affinity by Canva (Designer)
 * ============================================================================
*/

/*
 * -----------------------------------------------------------------------
 * Version history:
 * v1.27 - 2024-06-10: Added support for French language; fixed a bug
 *   where the settings panel would not update its labels when the
 *   language was changed.
 * v1.26 - 2024-05-15: Fixed a bug where the settings panel would not
 *   update its labels when the language was changed.
 * -----------------------------------------------------------------------
 * Generates print-ready cut contour shapes (rectangles and ellipses,
 * optionally combined with a positioned hanging hole) on a dedicated
 * "CutContour" layer, while automatically keeping the artwork,
 * finishing/varnish/gold and white layers separated and stacked in the
 * correct order. A compact button-grid dialog lets you create a shape
 * with a single click; a gear icon reveals a settings panel to switch
 * the interface language (Italian/English/French) and the document
 * units (mm/inch), both remembered for next time. Confirming the dialog
 * offers to export the current document as a print-ready PDF (PDF/X-4
 * preset) into an "Out" folder on the Desktop, named after the document
 * itself.
 *
 * License: MIT
 * Author: Iurie Olaru
 * -----------------------------------------------------------------------
 */
'use strict';

const { app } = require('/application.js');
const { Document, RasterFormat, UnitType, FileExportOptions, FileExportArea } = require('/document.js');
const { Dialog, DialogResult, HorizontalAlignment } = require('/dialog.js');
const { ShapeNodeDefinition, ContainerNodeDefinition, NodeChildType } = require('/nodes.js');
const { ShapeRectangle, ShapeEllipse } = require('/shapes.js');
const { FillDescriptor } = require('/fills.js');
const { LineStyleDescriptor } = require('/linestyle.js');
const { CMYK8 } = require('/colours.js');
const { AddChildNodesCommandBuilder, DocumentCommand, NodeMoveType } = require('/commands.js');
const { Selection } = require('/selections.js');
const { File, FileSystemApi } = require('/fs.js');
const fsModule = require('/fs.js');
const { Buffer } = require('/buffer.js');

// Constants for the final PDF export, taken identically from
// "Export PDF v1.0" (same preset and same "Out" folder on the Desktop
// already used by Selective White/FINISHING/Export PDF), so the file
// exported by this script ends up in the same place and with the same
// naming convention as the other exports in the suite.
const EXPORT_PRESET_NAME = "PDF stampa PDF/X-4 compatibile";
const EXPORT_FOLDER_NAME = "Out";

const LANGUAGES = ["ITA", "ENG", "FRA"];
const UNIT_CODES = ["mm", "inc"];
const DEFAULT_SETTINGS = { language: "ITA", units: "mm" };
const settingsPath = app.userDesktopPath + "/CutContourPRESTA_settings.json";

function loadSettings() {
    try {
        if (!FileSystemApi.exists(settingsPath)) return Object.assign({}, DEFAULT_SETTINGS);
        const f = new File(settingsPath, 'r');
        const len = f.length;
        const buf = Buffer.create(len);
        f.read(buf, len);
        f.close();
        const parsed = JSON.parse(buf.toString('utf8'));
        return {
            language: LANGUAGES.indexOf(parsed.language) !== -1 ? parsed.language : DEFAULT_SETTINGS.language,
            units: UNIT_CODES.indexOf(parsed.units) !== -1 ? parsed.units : DEFAULT_SETTINGS.units
        };
    } catch (e) {
        return Object.assign({}, DEFAULT_SETTINGS);
    }
}

function saveSettings(settings) {
    try {
        const f = new File(settingsPath, 'w');
        f.writeStringAsUtf8(JSON.stringify(settings));
        f.close();
    } catch (e) {
        console.log("Impossibile salvare le impostazioni:", e.message);
    }
}

const settings = loadSettings();
let currentLanguage = settings.language;
let currentUnits = settings.units;

const TRANSLATIONS = {
    ITA: {
        dialogTitle: "CUT CONTOUR from PreSta v.1.10",
        noDocTitle: "Attenzione",
        noDocMessage: "Nessun file selezionato. Script terminato.",
        settingsCaption: "Impostazioni",
        languageLabel: "Lingua:",
        unitsLabel: "Unita documento:",
        finalAlertTitle: "CutContour",
        finalAlertMessage: "Vuoi esportare il file in PDF?",
        exportError: (err) => "Errore durante l'esportazione PDF:\n\n" + err
    },
    ENG: {
        dialogTitle: "CUT CONTOUR from PreSta v.1.10",
        noDocTitle: "Warning",
        noDocMessage: "No file selected. Script terminated.",
        settingsCaption: "Settings",
        languageLabel: "Language:",
        unitsLabel: "Document Units:",
        finalAlertTitle: "CutContour",
        finalAlertMessage: "Do you want to export the file to PDF?",
        exportError: (err) => "Error during PDF export:\n\n" + err
    },
    FRA: {
        dialogTitle: "CUT CONTOUR from PreSta v.1.10",
        noDocTitle: "Attention",
        noDocMessage: "Aucun fichier selectionne. Script termine.",
        settingsCaption: "Parametres",
        languageLabel: "Langue :",
        unitsLabel: "Unites du document :",
        finalAlertTitle: "CutContour",
        finalAlertMessage: "Voulez-vous exporter le fichier en PDF ?",
        exportError: (err) => "Erreur lors de l'export PDF :\n\n" + err
    }
};

function t(key) {
    return TRANSLATIONS[currentLanguage][key];
}

let doc = app.documents.current;

if (!doc) {
    const path = app.chooseFile();
    if (!path) {
        app.alert(t("noDocMessage"), t("noDocTitle"));
    } else {
        doc = Document.load(path);
    }
}

if (doc) {
    doc.units = (currentUnits === "inc") ? UnitType.Inch : UnitType.Millimetre;
    doc.format = RasterFormat.CMYKA8;

    const spread = doc.currentSpread;
    const mmToPx = mm => mm * doc.dpi / 25.4;

    function findLayer(name) {
        for (const layer of spread.layers) {
            if (layer.userDescription === name) return layer;
        }
        return null;
    }

    function createLayer(name) {
        const def = ContainerNodeDefinition.createDefault();
        const builder = AddChildNodesCommandBuilder.create();
        builder.setInsertionTarget(spread);
        builder.addContainerNode(def);
        const cmd = builder.createCommand(true, NodeChildType.Main);
        doc.executeCommand(cmd);
        const newLayer = cmd.newNodes[0];
        doc.setLayerDescription(name, newLayer);
        return newLayer;
    }

    function ensureLayersAndSeparateGraphics() {
        let graficaLayer = findLayer("Grafica");
        let cutLayer = findLayer("CutContour");

        const finishingNames = ["finishing", "varnish", "gold"];
        const whiteNames = ["white"];

        let finishingLayer = null;
        let whiteLayer = null;
        for (const layer of spread.layers) {
            if (layer === graficaLayer || layer === cutLayer) continue;
            const desc = (layer.userDescription || "").toLowerCase();
            if (!finishingLayer && finishingNames.indexOf(desc) !== -1) {
                finishingLayer = layer;
            } else if (!whiteLayer && whiteNames.indexOf(desc) !== -1) {
                whiteLayer = layer;
            }
        }

        if (finishingLayer) doc.setLayerDescription("Finishing", finishingLayer);
        if (whiteLayer) doc.setLayerDescription("white", whiteLayer);

        const looseNodes = Array.from(spread.layers).filter(n =>
            n !== graficaLayer && n !== cutLayer && n !== finishingLayer && n !== whiteLayer
        );

        if (!graficaLayer) graficaLayer = createLayer("Grafica");
        if (!cutLayer) cutLayer = createLayer("CutContour");

        if (looseNodes.length > 0) {
            const sel = Selection.create(doc, looseNodes);
            doc.executeCommand(DocumentCommand.createMoveNodes(sel, graficaLayer, NodeMoveType.Inside, NodeChildType.Main));
        }

        let referenceLayer = graficaLayer;
        if (whiteLayer) {
            const selW = Selection.create(doc, whiteLayer);
            doc.executeCommand(DocumentCommand.createMoveNodes(selW, referenceLayer, NodeMoveType.After, NodeChildType.Main));
            referenceLayer = whiteLayer;
        }
        if (finishingLayer) {
            const selF = Selection.create(doc, finishingLayer);
            doc.executeCommand(DocumentCommand.createMoveNodes(selF, referenceLayer, NodeMoveType.After, NodeChildType.Main));
            referenceLayer = finishingLayer;
        }
        const selC = Selection.create(doc, cutLayer);
        doc.executeCommand(DocumentCommand.createMoveNodes(selC, referenceLayer, NodeMoveType.After, NodeChildType.Main));

        return { graficaLayer, cutLayer, finishingLayer, whiteLayer };
    }

    const { cutLayer } = ensureLayersAndSeparateGraphics();

    function clearCutContourLayer() {
        Array.from(cutLayer.children).forEach(n => n.delete());
    }

    // Exports the current document to PDF, called when the user
    // confirms (OK) the final message. Same exact logic as
    // "Export PDF v1.0" (same preset, same "Out" folder on the Desktop,
    // same file name pattern "<documentName>_ok.pdf"), so the result
    // ends up in the same place as the other exports in the suite. On
    // error an alert is shown with the details; on success no alert is
    // shown (the success alert was removed per user request, see
    // below).
    function exportCutContourPdf() {
        try {
            const outFolderPath = app.userDesktopPath + "/" + EXPORT_FOLDER_NAME;
            if (!fsModule.exists(outFolderPath)) {
                fsModule.createDirectory(outFolderPath);
            }

            const originalName = doc.title || "documento";
            const baseName = originalName.replace(/\.[^/.]+$/, "");
            const outFilePath = outFolderPath + "/" + baseName + "_ok.pdf";

            const exportOptions = FileExportOptions.createWithPresetName(EXPORT_PRESET_NAME);
            const exportArea = FileExportArea.createForWholeDocument();
            const records = doc.export(outFilePath, exportOptions, exportArea);

            let allOk = true;
            let errDetails = '';
            for (const r of records.all) {
                if (!r.isSuccess) {
                    allOk = false;
                    errDetails += '\n' + (r.errorMessage || 'sconosciuto');
                }
            }

            // The "PDF exported successfully..." alert was removed per
            // user request - no longer needed. On error the alert is
            // still shown.
            if (!allOk) {
                app.alert(t("exportError")(errDetails), t("finalAlertTitle"));
            }
        } catch (e) {
            app.alert(t("exportError")(e.message), t("finalAlertTitle"));
        }
    }

    function getPageBoundsPx() {
        if (doc.hasArtboards) {
            const box = doc.artboards.first.artboardInterface.spreadBaseBox;
            return { x: box.x, y: box.y, width: box.width, height: box.height };
        }
        return { x: 0, y: 0, width: doc.widthPixels, height: doc.heightPixels };
    }

    function getOuterBoundsPx(marginMm) {
        const page = getPageBoundsPx();
        const m = mmToPx(marginMm);
        return { x: page.x + m, y: page.y + m, width: page.width - 2 * m, height: page.height - 2 * m };
    }

    function makeCutFill() {
        const c = CMYK8(0, 255, 0, 0);
        c.overprint = true;
        return FillDescriptor.createSolid(c);
    }

    function makeCutLineStyle() {
        return LineStyleDescriptor.createDefault(0.25 * doc.dpi / 72);
    }

    function addCutShape(ShapeClass, rect, name) {
        const def = ShapeNodeDefinition.create(ShapeClass.create(), rect, null, makeCutFill(), makeCutLineStyle(), null);
        def.userDescription = name;
        doc.addNode(def, cutLayer, NodeChildType.Main);
    }

    function getHoleCenterPx(posKey, distMm) {
        const page = getPageBoundsPx();
        const d = mmToPx(distMm);
        switch (posKey) {
            case "top-center":   return { cx: page.x + page.width / 2, cy: page.y + d };
            case "top-left":     return { cx: page.x + d,              cy: page.y + d };
            case "top-right":    return { cx: page.x + page.width - d, cy: page.y + d };
            case "left-middle":  return { cx: page.x + d,              cy: page.y + page.height / 2 };
            case "right-middle": return { cx: page.x + page.width - d, cy: page.y + page.height / 2 };
        }
    }

    function addHole(posKey, distMm) {
        const diameterPx = mmToPx(4);
        const { cx, cy } = getHoleCenterPx(posKey, distMm);
        addCutShape(ShapeEllipse, { x: cx - diameterPx / 2, y: cy - diameterPx / 2, width: diameterPx, height: diameterPx }, "foro");
    }

    function selectAllCutContourShapes() {
        const shapes = Array.from(cutLayer.children);
        if (shapes.length > 0) {
            const sel = Selection.create(doc, shapes);
            doc.executeCommand(DocumentCommand.createSetSelection(sel));
        }
    }

    function createCutContourRectMargin(marginMm) {
        clearCutContourLayer();
        addCutShape(ShapeRectangle, getOuterBoundsPx(marginMm), "cut");
        selectAllCutContourShapes();
    }

    function createCutContourEllipseMargin(marginMm) {
        clearCutContourLayer();
        addCutShape(ShapeEllipse, getOuterBoundsPx(marginMm), "cut");
        selectAllCutContourShapes();
    }

    function createCutContourRect() {
        createCutContourRectMargin(2);
    }

    function createCutContourEllipse() {
        createCutContourEllipseMargin(2);
    }

    function createRectWithHole(posKey) {
        return function () {
            clearCutContourLayer();
            addCutShape(ShapeRectangle, getOuterBoundsPx(2), "cut");
            addHole(posKey, 7);
            selectAllCutContourShapes();
        };
    }

    function createEllipseWithHole(posKey) {
        return function () {
            clearCutContourLayer();
            addCutShape(ShapeEllipse, getOuterBoundsPx(2), "cut");
            addHole(posKey, 7);
            selectAllCutContourShapes();
        };
    }

    function createCutContourRectInset7() {
        createCutContourRectMargin(7);
    }

    function createCutContourEllipseInset7() {
        createCutContourEllipseMargin(7);
    }

    // Button icons changed from blue to green per user request
    // (🟦 → 🟩 for rectangles, 🔵 → 🟢 for ellipses).
    const row1 = [
        { label: "🟩",   action: createCutContourRect },
        { label: "🟢",   action: createCutContourEllipse },
        { label: "🟩⚬↑", action: createRectWithHole("top-center") },
        { label: "🟩⚬↖", action: createRectWithHole("top-left") },
        { label: "🟩⚬←", action: createRectWithHole("left-middle") },
        { label: "🟩⚬↗", action: createRectWithHole("top-right") }
    ];

    const row2 = [
        { label: "🟩⚬→", action: createRectWithHole("right-middle") },
        { label: "🟢⚬↑", action: createEllipseWithHole("top-center") },
        { label: "🟢⚬←", action: createEllipseWithHole("left-middle") },
        { label: "🟢⚬→", action: createEllipseWithHole("right-middle") },
        { label: "🟩💋", action: createCutContourRectInset7 },
        { label: "🟢💋", action: createCutContourEllipseInset7 }
    ];

    const dlg = Dialog.create(t("dialogTitle"));
    dlg.isResizable = true;
    // Initial dialog width set to 400px per user request (previously
    // 500px, calculated as +25% over an estimated ~400px auto-sized
    // width). dlg.isResizable stays true, so the user can still resize
    // the dialog manually.
    dlg.initialWidth = 400;
    const col = dlg.addColumn();

    const gearRowGroup = col.addGroup("");
    gearRowGroup.enableSeparator = false;
    const gearBtn = gearRowGroup.addButton("⚙️");
    gearBtn.alignment = HorizontalAlignment.Right;

    const settingsGroup = col.addGroup("");
    settingsGroup.enableSeparator = true;

    const settingsCaptionCtrl = settingsGroup.addStaticText("", t("settingsCaption"));
    const languageLabelCtrl = settingsGroup.addStaticText("", t("languageLabel"));
    const languageDisplayItems = ["Italiano", "English", "Français"];
    const langCombo = settingsGroup.addComboBox("", languageDisplayItems, LANGUAGES.indexOf(currentLanguage));
    const unitsLabelCtrl = settingsGroup.addStaticText("", t("unitsLabel"));
    const unitsCombo = settingsGroup.addComboBox("", UNIT_CODES, UNIT_CODES.indexOf(currentUnits));

    const settingsControls = [settingsCaptionCtrl, languageLabelCtrl, langCombo, unitsLabelCtrl, unitsCombo];
    let settingsPanelVisible = false;
    settingsControls.forEach(c => c.isVisible = settingsPanelVisible);

    gearBtn.setOnClickHandler(function () {
        settingsPanelVisible = !settingsPanelVisible;
        settingsControls.forEach(c => c.isVisible = settingsPanelVisible);
    });

    function refreshSettingsPanelTexts() {
        settingsCaptionCtrl.text = t("settingsCaption");
        languageLabelCtrl.text = t("languageLabel");
        unitsLabelCtrl.text = t("unitsLabel");
    }

    langCombo.setOnValueChangedHandler(function (newIndex) {
        currentLanguage = LANGUAGES[newIndex];
        settings.language = currentLanguage;
        saveSettings(settings);
        refreshSettingsPanelTexts();
    });

    unitsCombo.setOnValueChangedHandler(function (newIndex) {
        currentUnits = UNIT_CODES[newIndex];
        settings.units = currentUnits;
        saveSettings(settings);
        doc.units = (currentUnits === "inc") ? UnitType.Inch : UnitType.Millimetre;
    });

    // ALL button rows share a SINGLE DialogGroup (buttonsGroup), instead
    // of a separate DialogGroup per row. Each row is still its own
    // distinct DialogColumnStack (one call to
    // buttonsGroup.addColumnStack() per row), but all rows live inside
    // the same logical "box": this removes the vertical space the
    // layout engine reserves for the margins of EVERY group, which used
    // to be repeated 6 times with 6 separate groups - the cause of the
    // excessive spacing between rows originally reported by the user.
    function addButtonRow(buttonsGroup, items) {
        const colStack = buttonsGroup.addColumnStack();
        items.forEach(item => {
            const subCol = colStack.addColumn();
            // 75/25 ratio between the button column and the empty
            // column (originally 50/50, corrected per user feedback).
            // widthProportion is a relative weight between the columns
            // of the same row: 3 versus 1 gives exactly 75% to the
            // button and 25% to the empty space.
            subCol.widthProportion = 3;
            const grp = subCol.addGroup("");
            grp.enableSeparator = false;
            const btn = grp.addButton(item.label);
            btn.isFullWidth = true;
            btn.setOnClickHandler(item.action);
            // "Naked" empty column - per user request the empty
            // DialogGroup that used to be inside it was removed (it had
            // originally been added only for "structural symmetry" with
            // the button column, but turned out to be unnecessary: the
            // 75/25 ratio still holds, the two columns with their
            // respective widthProportion values are enough).
            const spacerCol = colStack.addColumn();
            spacerCol.widthProportion = 1;
        });
    }

    const buttonsGroup = col.addGroup("");
    buttonsGroup.enableSeparator = false;

    const allButtons = row1.concat(row2);
    for (let i = 0; i < allButtons.length; i += 2) {
        addButtonRow(buttonsGroup, allButtons.slice(i, i + 2));
    }

    const result = dlg.runModal();
    if (result.value === DialogResult.Ok.value) {
        // The simple app.alert() (OK only) was replaced with
        // app.confirm(), which shows the two standard interface buttons
        // (CANCEL/OK, in the app's own language) - the SDK provides no
        // way to customize the labels of this native dialog, but since
        // the app's UI language is Italian it shows "Annulla"/"OK" as
        // requested. On OK the PDF is exported (exportCutContourPdf());
        // on CANCEL nothing happens.
        // Automatic application of the CutContour style has since been
        // removed: the message text no longer talks about "style
        // applied automatically", it simply asks whether to export the
        // file.
        const confirmed = app.confirm(t("finalAlertMessage"), t("finalAlertTitle"));
        if (confirmed) {
            exportCutContourPdf();
        }
    }
}