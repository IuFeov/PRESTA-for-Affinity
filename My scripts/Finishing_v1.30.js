//@title Finishing v1.30 (final)
// @description FINISHING for special effect print technologies suach as selective Gold, Argent, 3D and Transparent prints. 
// @author Iurie Olaru
// @version 1.21
// @affinity 
// @verified 
// @homepage 
// @github 
// @tags 
// @image 

// Licenza libera tipo MIT

/* ============================================================================
 *  FINISHING  —  v1.30
 *  Script per Affinity by Canva (Designer)
 * ============================================================================
 * v1.30: aggiunta la gestione "nessun documento aperto", ripresa
 *  identica da "Cut Contour PRESTA - v27" (stesso schema verificato e già
 *  in uso in quello script): se non c'è un documento attivo quando lo
 *  script parte, si apre il selettore file nativo (app.chooseFile()); se
 *  l'utente sceglie un file, viene caricato con Document.load(path) e lo
 *  script prosegue normalmente su quel documento; se l'utente annulla la
 *  selezione (chooseFile restituisce un valore falsy), viene mostrato un
 *  messaggio di terminazione e lo script si ferma — quindi il messaggio
 *  compare SOLO dopo il tentativo di scelta del file, mai prima. Prima
 *  di questa versione lo script si limitava a mostrare subito "Nessun
 *  documento aperto" e terminava, senza offrire la possibilità di
 *  aprirne uno. Nessun'altra logica è stata modificata.
 * ==========================================================================*/
'use strict';

(function finishingMainV130() {
    const { app } = require('/application');
    const { UnitType, DocumentCommand, NodeChildType, NodeMoveType, AddChildNodesCommandBuilder } = require('/commands');
    const { Selection } = require('/selections');
    const { ContainerNodeDefinition } = require('/nodes');
    const { DocumentCommandApi } = require('affinity:commands');
    const { Document, FileExportOptions, FileExportArea } = require('/document');
    const fsModule = require('/fs');
    const { File } = require('/fs');

    const APP_TITLE = "FINISHING v1.0 from PRESTA";
    const MACRO_FOLDER_NAME = "Affinity Impostazioni";
    const SETTINGS_FILENAME = "sets.json";
    const EXPAND_MACRO_FILENAME = "Espandi tratto.afmacro";
    const STYLE_MACRO_FILENAME = "Apply FINISHING Style.afmacro";
    const EXPORT_PRESET_NAME = "PDF stampa PDF/X-4 compatibile";
    const EXPORT_FOLDER_NAME = "Out";
    const PROTECTED_LAYER_NAMES = ['finishing', 'white', 'cutcontour'];
    const NAME_KEYWORDS = ['finishing', 'vernice', 'gold', 'silver', 'argento', 'oro'];
    const FINAL_FINISHING_NAME = 'Finishing';
    const GRAPHICS_LAYER_NAME = 'Graphics';
    let TARGET_CMYK = { c: 0, m: 0.5, y: 1, k: 0 };
    const CMYK_TOL = 0.04;
    const UNION_BLOCK_SIZE = 220;
    const MAX_CONSOLIDATION_PASSES = 8;
    const NO_PROGRESS_LIMIT = 2;

    const MESSAGES = {
        it: {
            noDocument: "Nessun documento aperto.",
            noFileSelected: "Nessun file selezionato. Script terminato.",
            folderCreated: (folder) => 'Cartella "' + folder + '" creata sul Desktop.\n\nEsporta ora la macro "Espandi tratto" (clic destro sulla macro nel pannello Macro → Esporta) in quella cartella, poi rilancia lo script.',
            noMacroFile: (folder) => 'Nessun file macro (.afmacro) trovato nella cartella "' + folder + '" sul Desktop.\n\nEsporta la macro "Espandi tratto" lì (clic destro sulla macro nel pannello Macro → Esporta), poi rilancia lo script.',
            styleMacroMissing: (filename, folder) => 'File macro "' + filename + '" non trovato nella cartella "' + folder + '" sul Desktop.\n\nEsporta lì la macro che applica lo Stile (clic destro sulla macro nel pannello Macro → Esporta), poi rilancia lo script.',
            noObjectFound: 'Nessun oggetto trovato in Finishing.\n\nSeleziona nel documento un oggetto che può essere considerato "finishing" (quello che rappresenta il colore/vernice da usare) e rilancia lo script.',
            noObjectFoundEvenWithSelection: "Nessun oggetto trovato nemmeno con il colore dell'oggetto selezionato.",
            expandMacroError: (err, folder) => "Errore nel richiamare la macro \"Espandi tratto\" dal file:\n\n" + err + "\n\nVerifica che il file in \"" + folder + "\" sul Desktop sia valido.",
            noValidObjectAfterExpand: "Trovati candidati, ma nessun oggetto valido dopo l'espansione.",
            styleMacroError: (err, folder) => "Errore nel richiamare la macro \"Apply FINISHING Style\" dal file:\n\n" + err + "\n\nVerifica che il file in \"" + folder + "\" sul Desktop sia valido.",
            doneLabel: 'Fatto:',
            doneBody: (count) => ' ' + count + ' tracciati raccolti, uniti e con lo Stile applicato nel livello "Finishing" (in ' + '%PAGES%' + ').',
            buttonNoteCancel: 'ANNULLA per PROSEGUIRE in Affinity Designer',
            buttonNoteOk: 'OK per ESPORTARE in PDF',
            unmovedLayers: (names) => '\n\nAttenzione: ' + names.length + ' livello/i troppo grande/i o complesso/i per essere spostato/i automaticamente in "Graphics" (spostali manualmente): ' + names.join(', ') + '.',
            leftoverFinishing: (count) => '\n\nAttenzione: ' + count + ' tracciato/i "Finishing" non sono stati uniti dopo ' + MAX_CONSOLIDATION_PASSES + ' tentativi e sono finiti in "Graphics" — verificali manualmente.',
            multiPieceFinishing: (count) => '\n\nNota: il livello "Finishing" contiene ' + count + ' tracciati distinti con lo stesso colore/stile invece di uno solo — la complessità geometrica del documento non permette al motore di Affinity di fonderli in un unico tracciato (limite del motore, non un errore dello script). La raccolta è comunque completa e corretta: non serve rilanciare lo script.',
            exportSuccess: (filename, folder) => 'PDF esportato: "' + filename + '" in "' + folder + '" sul Desktop.',
            exportError: (err) => "Errore durante l'esportazione PDF:\n\n" + err,
            genericError: (err) => "Errore durante l'esecuzione dello script:\n\n" + err
        },
        en: {
            noDocument: "No document open.",
            noFileSelected: "No file selected. Script terminated.",
            folderCreated: (folder) => 'Folder "' + folder + '" created on the Desktop.\n\nNow export the "Expand Stroke" macro (right-click the macro in the Macro panel → Export) into that folder, then re-run the script.',
            noMacroFile: (folder) => 'No macro file (.afmacro) found in the "' + folder + '" folder on the Desktop.\n\nExport the "Expand Stroke" macro there (right-click the macro in the Macro panel → Export), then re-run the script.',
            styleMacroMissing: (filename, folder) => 'Macro file "' + filename + '" not found in the "' + folder + '" folder on the Desktop.\n\nExport there the macro that applies the Style (right-click the macro in the Macro panel → Export), then re-run the script.',
            noObjectFound: 'No object found by Finishing.\n\nSelect an object in the document that can be considered "finishing" (the one representing the colour/varnish to use) and re-run the script.',
            noObjectFoundEvenWithSelection: "No object found even using the colour of the selected object.",
            expandMacroError: (err, folder) => "Error calling the \"Expand Stroke\" macro from file:\n\n" + err + "\n\nCheck that the file in \"" + folder + "\" on the Desktop is valid.",
            noValidObjectAfterExpand: "Candidates found, but no valid object after expansion.",
            styleMacroError: (err, folder) => "Error calling the \"Apply FINISHING Style\" macro from file:\n\n" + err + "\n\nCheck that the file in \"" + folder + "\" on the Desktop is valid.",
            doneLabel: 'Done:',
            doneBody: (count) => ' ' + count + ' paths collected, united and with the Style applied in the "Finishing" layer (in ' + '%PAGES%' + ').',
            buttonNoteCancel: 'CANCEL to CONTINUE in Affinity Designer',
            buttonNoteOk: 'OK to EXPORT as PDF',
            unmovedLayers: (names) => '\n\nNote: ' + names.length + ' layer(s) too large or complex to be moved automatically into "Graphics" (move them manually): ' + names.join(', ') + '.',
            leftoverFinishing: (count) => '\n\nNote: ' + count + ' "Finishing" path(s) could not be united after ' + MAX_CONSOLIDATION_PASSES + ' attempts and ended up in "Graphics" — check them manually.',
            multiPieceFinishing: (count) => '\n\nNote: the "Finishing" layer contains ' + count + ' separate paths with the same colour/style instead of a single one — the document\'s geometric complexity does not allow the Affinity engine to merge them into one path (an engine limit, not a script error). The collection is nonetheless complete and correct: there is no need to re-run the script.',
            exportSuccess: (filename, folder) => 'PDF exported: "' + filename + '" in "' + folder + '" on the Desktop.',
            exportError: (err) => "Error during PDF export:\n\n" + err,
            genericError: (err) => "Error while running the script:\n\n" + err
        },
        fr: {
            noDocument: "Aucun document ouvert.",
            noFileSelected: "Aucun fichier selectionne. Script termine.",
            folderCreated: (folder) => 'Le dossier "' + folder + '" a été créé sur le Bureau.\n\nExportez maintenant la macro "Développer le tracé" (clic droit sur la macro dans le panneau Macro → Exporter) dans ce dossier, puis relancez le script.',
            noMacroFile: (folder) => 'Aucun fichier macro (.afmacro) trouvé dans le dossier "' + folder + '" sur le Bureau.\n\nExportez-y la macro "Développer le tracé" (clic droit sur la macro dans le panneau Macro → Exporter), puis relancez le script.',
            styleMacroMissing: (filename, folder) => 'Fichier macro "' + filename + '" introuvable dans le dossier "' + folder + '" sur le Bureau.\n\nExportez-y la macro qui applique le Style (clic droit sur la macro dans le panneau Macro → Exporter), puis relancez le script.',
            noObjectFound: 'Aucun objet trouvé par Finishing.\n\nSélectionnez dans le document un objet pouvant être considéré comme "finishing" (celui représentant la couleur/vernis à utiliser) et relancez le script.',
            noObjectFoundEvenWithSelection: "Aucun objet trouvé même avec la couleur de l'objet sélectionné.",
            expandMacroError: (err, folder) => "Erreur lors de l'appel de la macro \"Développer le tracé\" depuis le fichier :\n\n" + err + "\n\nVérifiez que le fichier dans \"" + folder + "\" sur le Bureau est valide.",
            noValidObjectAfterExpand: "Candidats trouvés, mais aucun objet valide après l'expansion.",
            styleMacroError: (err, folder) => "Erreur lors de l'appel de la macro \"Apply FINISHING Style\" depuis le fichier :\n\n" + err + "\n\nVérifiez que le fichier dans \"" + folder + "\" sur le Bureau est valide.",
            doneLabel: 'Terminé :',
            doneBody: (count) => ' ' + count + ' tracés collectés, réunis et avec le Style appliqué dans le calque "Finishing" (dans ' + '%PAGES%' + ').',
            buttonNoteCancel: 'ANNULER pour CONTINUER dans Affinity Designer',
            buttonNoteOk: 'OK pour EXPORTER en PDF',
            unmovedLayers: (names) => '\n\nRemarque : ' + names.length + ' calque(s) trop volumineux ou complexe(s) pour être déplacé(s) automatiquement dans "Graphics" (déplacez-les manuellement) : ' + names.join(', ') + '.',
            leftoverFinishing: (count) => '\n\nRemarque : ' + count + ' tracé(s) "Finishing" n\'ont pas pu être réunis après ' + MAX_CONSOLIDATION_PASSES + ' tentatives et se sont retrouvés dans "Graphics" — vérifiez-les manuellement.',
            multiPieceFinishing: (count) => '\n\nRemarque : le calque "Finishing" contient ' + count + ' tracés distincts avec la même couleur/style au lieu d\'un seul — la complexité géométrique du document ne permet pas au moteur d\'Affinity de les fusionner en un seul tracé (limite du moteur, pas une erreur du script). La collecte est néanmoins complète et correcte : il n\'est pas nécessaire de relancer le script.',
            exportSuccess: (filename, folder) => 'PDF exporté : "' + filename + '" dans "' + folder + '" sur le Bureau.',
            exportError: (err) => "Erreur lors de l'export PDF :\n\n" + err,
            genericError: (err) => "Erreur lors de l'exécution du script :\n\n" + err
        }
    };

    let userSettings = { lang: 'it', documentUnits: 'Millimetre', strokeWidthUnit: 'Point' };
    const settingsFolderPath = app.userDesktopPath + "/" + MACRO_FOLDER_NAME;
    const settingsFilePath = settingsFolderPath + "/" + SETTINGS_FILENAME;
    if (fsModule.exists(settingsFilePath)) {
        try {
            const buf = File.readAll(settingsFilePath);
            const parsed = JSON.parse(buf.toString('utf8'));
            userSettings = Object.assign(userSettings, parsed);
        } catch (e) {}
    }
    const LANG = MESSAGES[userSettings.lang] ? userSettings.lang : 'it';
    const M = MESSAGES[LANG];

    // v1.30: se non c'è un documento attivo, offre di sceglierne uno da
    // disco (stesso schema di "Cut Contour PRESTA - v27") invece di
    // terminare subito. Il messaggio di terminazione compare SOLO se
    // l'utente annulla la scelta del file (chooseFile restituisce un
    // valore falsy), mai prima di avergli dato la possibilità di sceglierne
    // uno.
    let doc = app.documents.current;
    if (!doc) {
        const chosenPath = app.chooseFile();
        if (!chosenPath) {
            app.alert(M.noFileSelected, APP_TITLE);
            return;
        }
        doc = Document.load(chosenPath);
    }
    if (!doc) {
        app.alert(M.noDocument, APP_TITLE);
        return;
    }

    try {

    const initialSelectionNodes = [];
    try {
        for (const n of doc.selection.nodes) initialSelectionNodes.push(n);
    } catch (e) {}

    const macroFolderPath = settingsFolderPath;

    if (!fsModule.exists(macroFolderPath)) {
        fsModule.createDirectory(macroFolderPath);
        app.alert(M.folderCreated(MACRO_FOLDER_NAME), APP_TITLE);
        return;
    }

    function findMacroFile(folderPath, preferredName) {
        const preferredPath = folderPath + "/" + preferredName;
        if (fsModule.exists(preferredPath)) return preferredPath;
        try {
            const { Directory } = require('/fs');
            const dir = new Directory(folderPath);
            for (const entry of dir.entries) {
                if (entry.path.toLowerCase().endsWith(".afmacro")) return entry.path;
            }
        } catch (e) {}
        return null;
    }

    const expandMacroPath = findMacroFile(macroFolderPath, EXPAND_MACRO_FILENAME);
    if (!expandMacroPath) {
        app.alert(M.noMacroFile(MACRO_FOLDER_NAME), APP_TITLE);
        return;
    }

    const styleMacroPath = macroFolderPath + "/" + STYLE_MACRO_FILENAME;
    if (!fsModule.exists(styleMacroPath)) {
        app.alert(M.styleMacroMissing(STYLE_MACRO_FILENAME, MACRO_FOLDER_NAME), APP_TITLE);
        return;
    }

    const unitTypeValue = (UnitType[userSettings.documentUnits] !== undefined)
        ? UnitType[userSettings.documentUnits]
        : UnitType.Millimetre;
    doc.executeCommand(DocumentCommand.createSetDocumentUnits(unitTypeValue));

    function safeBool(fn) { try { return !!fn(); } catch (e) { return false; } }
    function normName(s) { return (s || '').trim().toLowerCase(); }
    function isProtectedLayer(node) {
        const isFolder = safeBool(() => node.isGroupNode) || safeBool(() => node.isContainerNode);
        return isFolder && PROTECTED_LAYER_NAMES.indexOf(normName(node.description)) !== -1;
    }
    function hasNameKeyword(name) {
        const n = normName(name);
        return !!n && NAME_KEYWORDS.some(k => n.indexOf(k) !== -1);
    }
    function colourIsFinishingCMYK(colour) {
        try {
            const c = colour.cmykaf;
            return (Math.abs(c.c - TARGET_CMYK.c) <= CMYK_TOL) &&
                   (Math.abs(c.m - TARGET_CMYK.m) <= CMYK_TOL) &&
                   (Math.abs(c.y - TARGET_CMYK.y) <= CMYK_TOL) &&
                   (Math.abs(c.k - TARGET_CMYK.k) <= CMYK_TOL);
        } catch (e) { return false; }
    }
    function hasFinishingStroke(node) {
        try {
            if (!node.hasPenFill) return false;
            const c = node.penFillDescriptor.fill.colour;
            if (!c) return false;
            return colourIsFinishingCMYK(c) || hasNameKeyword(node.description);
        } catch (e) { return false; }
    }
    function hasFinishingFill(node) {
        try {
            if (!node.hasBrushFill) return false;
            const c = node.brushFillDescriptor.fill.colour;
            if (!c) return false;
            return colourIsFinishingCMYK(c) || hasNameKeyword(node.description);
        } catch (e) { return false; }
    }
    function clearStrokeWidth(node) {
        try {
            if (typeof node.lineWeight === 'number' && node.lineWeight > 0) {
                node.lineWeight = 0;
            }
        } catch (e) {}
    }

    function promoteToSpreadHere(node) {
        let guard = 0;
        while (node && node.parent && node.parent[Symbol.toStringTag] !== 'SpreadNode' && guard < 25) {
            const parent = node.parent;
            try {
                const sel = Selection.create(doc, node);
                doc.executeCommand(DocumentCommand.createMoveNodes(sel, parent, NodeMoveType.After, NodeChildType.Main));
            } catch (e) { break; }
            guard++;
        }
        return node;
    }

    function unionBlock(nodesBlock) {
        for (const n of nodesBlock) promoteToSpreadHere(n);
        if (nodesBlock.length === 1) return nodesBlock[0];
        try {
            const sel = Selection.create(doc, nodesBlock);
            const unionCmd = new DocumentCommand(DocumentCommandApi.createBoolOpUnionCommand(sel.handle));
            doc.executeCommand(unionCmd);
            let resNodes = [...doc.selection.nodes];
            if (resNodes.length === 0) return null;
            if (resNodes.length > 1) {
                try {
                    const sel2 = Selection.create(doc, resNodes);
                    const unionCmd2 = new DocumentCommand(DocumentCommandApi.createBoolOpUnionCommand(sel2.handle));
                    doc.executeCommand(unionCmd2);
                    const resNodes2 = [...doc.selection.nodes];
                    if (resNodes2.length > 0) resNodes = resNodes2;
                } catch (e) { }
            }
            return resNodes[resNodes.length - 1];
        } catch (e) {
            return null;
        }
    }

    function unionAdaptive(nodesBlock) {
        if (!nodesBlock || nodesBlock.length === 0) return [];
        if (nodesBlock.length === 1) {
            promoteToSpreadHere(nodesBlock[0]);
            return [nodesBlock[0]];
        }
        const merged = unionBlock(nodesBlock);
        if (merged) return [merged];
        const mid = Math.floor(nodesBlock.length / 2);
        const leftPieces = unionAdaptive(nodesBlock.slice(0, mid));
        const rightPieces = unionAdaptive(nodesBlock.slice(mid));
        const pieces = [...leftPieces, ...rightPieces];
        if (pieces.length <= 1) return pieces;
        const combined = unionBlock(pieces);
        return combined ? [combined] : pieces;
    }

    function unionInBlocks(nodesArray, blockSize) {
        const clean = (nodesArray || []).filter(Boolean);
        if (clean.length === 0) return [];
        if (clean.length === 1) {
            promoteToSpreadHere(clean[0]);
            return clean;
        }
        const pieces = [];
        for (let i = 0; i < clean.length; i += blockSize) {
            const chunk = clean.slice(i, i + blockSize);
            pieces.push(...unionAdaptive(chunk));
        }
        if (pieces.length <= 1) return pieces;
        return unionAdaptive(pieces);
    }

    function findLeftoverFinishingCandidates(spreadNode) {
        const leftovers = [];
        function walk2(node) {
            if (safeBool(() => node.isVectorNode)) {
                if (hasFinishingStroke(node) || hasFinishingFill(node)) leftovers.push(node);
            }
            for (const c of node.children) walk2(c);
        }
        for (const l of [...spreadNode.children]) {
            if (isProtectedLayer(l)) continue;
            if (normName(l.description) === normName(FINAL_FINISHING_NAME)) continue;
            walk2(l);
        }
        return leftovers;
    }

    function collectFinishingLayerChildren(finishingLayerNode) {
        if (!finishingLayerNode) return [];
        return [...finishingLayerNode.children].filter(c => safeBool(() => c.isVectorNode));
    }

    function consolidateFinishing(spreadNode, finishingLayerNode) {
        let noProgressStreak = 0;
        for (let pass = 1; pass <= MAX_CONSOLIDATION_PASSES; pass++) {
            const existing = collectFinishingLayerChildren(finishingLayerNode);
            const leftovers = findLeftoverFinishingCandidates(spreadNode);
            if (leftovers.length === 0 && existing.length <= 1) break;
            const all = [...existing, ...leftovers];
            if (all.length === 0) break;
            for (const n of all) clearStrokeWidth(n);
            const mergedPieces = unionInBlocks(all, UNION_BLOCK_SIZE);
            for (const p of mergedPieces) clearStrokeWidth(p);
            if (mergedPieces.length > 0) {
                try {
                    const selU = Selection.create(doc, mergedPieces);
                    doc.executeCommand(DocumentCommand.createMoveNodes(selU, finishingLayerNode, NodeMoveType.Inside, NodeChildType.Main));
                } catch (e) {
                    for (const p of mergedPieces) {
                        try {
                            const selOne = Selection.create(doc, p);
                            doc.executeCommand(DocumentCommand.createMoveNodes(selOne, finishingLayerNode, NodeMoveType.Inside, NodeChildType.Main));
                        } catch (e2) {}
                    }
                }
            }
            const stillLeftover = findLeftoverFinishingCandidates(spreadNode).length;
            const stillMultiple = collectFinishingLayerChildren(finishingLayerNode).length > 1;
            if (stillLeftover === 0 && !stillMultiple) break;
            if (leftovers.length === 0 && mergedPieces.length >= existing.length) {
                noProgressStreak++;
                if (noProgressStreak >= NO_PROGRESS_LIMIT) break;
            } else {
                noProgressStreak = 0;
            }
        }
        const remainingLeftoverCount = findLeftoverFinishingCandidates(spreadNode).length;
        const finishingChildrenFinal = collectFinishingLayerChildren(finishingLayerNode);
        return {
            finalObjects: finishingChildrenFinal,
            remainingLeftoverCount: remainingLeftoverCount
        };
    }

    function sweepSpreadIntoGraphics(spreadNode, finishingLayerNode) {
        const unmovedNames = [];
        const spreadTopLevelAfter = [...spreadNode.children];
        let graphicsLayer = spreadTopLevelAfter.find(l => normName(l.description) === normName(GRAPHICS_LAYER_NAME)) || null;
        const remaining = spreadTopLevelAfter.filter(l =>
            normName(l.description) !== normName(FINAL_FINISHING_NAME) &&
            normName(l.description) !== normName(GRAPHICS_LAYER_NAME) &&
            !isProtectedLayer(l)
        );

        if (remaining.length > 0) {
            if (!graphicsLayer) {
                const defA = ContainerNodeDefinition.create(GRAPHICS_LAYER_NAME);
                const builderA = AddChildNodesCommandBuilder.create();
                builderA.setInsertionTarget(spreadNode);
                builderA.addContainerNode(defA);
                const cmdA = builderA.createCommand(true, NodeChildType.Main);
                doc.executeCommand(cmdA);
                graphicsLayer = cmdA.newNodes[0];
            }
            doc.setLayerDescription(GRAPHICS_LAYER_NAME, graphicsLayer);

            let insertAfter = null;
            for (const n of remaining) {
                try {
                    const selOne = Selection.create(doc, n);
                    if (insertAfter) {
                        doc.executeCommand(DocumentCommand.createMoveNodes(selOne, insertAfter, NodeMoveType.After, NodeChildType.Main));
                    } else {
                        doc.executeCommand(DocumentCommand.createMoveNodes(selOne, graphicsLayer, NodeMoveType.Inside, NodeChildType.Main));
                    }
                    insertAfter = n;
                } catch (e) {
                    unmovedNames.push(n.description || '?');
                }
            }
        }

        if (graphicsLayer && finishingLayerNode) {
            try {
                const selOrder = Selection.create(doc, finishingLayerNode);
                doc.executeCommand(DocumentCommand.createMoveNodes(selOrder, graphicsLayer, NodeMoveType.After, NodeChildType.Main));
            } catch (e) {}
        }

        const crossWhiteLayer = [...spreadNode.children].find(l => normName(l.description) === 'white') || null;
        if (crossWhiteLayer && graphicsLayer) {
            try {
                const selCrossW = Selection.create(doc, crossWhiteLayer);
                doc.executeCommand(DocumentCommand.createMoveNodes(selCrossW, graphicsLayer, NodeMoveType.After, NodeChildType.Main));
            } catch (e) {}
        }
        if (crossWhiteLayer && finishingLayerNode) {
            try {
                const selCrossF = Selection.create(doc, finishingLayerNode);
                doc.executeCommand(DocumentCommand.createMoveNodes(selCrossF, crossWhiteLayer, NodeMoveType.After, NodeChildType.Main));
            } catch (e) {}
        }

        if (graphicsLayer) {
            for (let pass = 0; pass < 50; pass++) {
                let target = null;
                function findNested(node) {
                    if (target) return;
                    for (const c of node.children) {
                        if (c !== graphicsLayer && [...c.children].length > 0) { target = c; return; }
                        findNested(c);
                        if (target) return;
                    }
                }
                findNested(graphicsLayer);
                if (!target) break;
                const kids = [...target.children];
                if (kids.length > 0) {
                    const selK = Selection.create(doc, kids);
                    doc.executeCommand(DocumentCommand.createMoveNodes(selK, target, NodeMoveType.After, NodeChildType.Main));
                }
                try { target.delete(); } catch (e) {}
            }
        }

        function cleanupEmptyAll(node) {
            for (const c of [...node.children]) cleanupEmptyAll(c);
            if ((node.isGroupNode || node.isContainerNode) && [...node.children].length === 0) {
                try { node.delete(); } catch (e) {}
            }
        }
        for (const l of [...spreadNode.children]) cleanupEmptyAll(l);

        return unmovedNames;
    }

    let totalCount = 0;
    let pagesProcessed = 0;
    let totalLeftoverUnresolved = 0;
    let totalMultiPieceCount = 0;
    const allUnmovedLayerNames = [];
    const finalObjectsForSelection = [];

    const spreadsArr = [...doc.spreads];

    for (const spread of spreadsArr) {
        try { doc.executeCommand(DocumentCommand.createSetCurrentSpread(spread)); } catch (e) {}

        const strokeCandidates = [];
        let fillCandidatesCount = 0;
        function walk(node) {
            if (node.isVectorNode) {
                if (hasFinishingStroke(node)) strokeCandidates.push(node);
                else if (hasFinishingFill(node)) fillCandidatesCount++;
            }
            for (const c of node.children) walk(c);
        }
        for (const l of spread.children) {
            if (isProtectedLayer(l)) continue;
            walk(l);
        }

        const spreadTopLevelPre = [...spread.children];
        let finishingLayer = spreadTopLevelPre.find(l => normName(l.description) === normName(FINAL_FINISHING_NAME)) || null;
        const existingFinishingCountPre = collectFinishingLayerChildren(finishingLayer).length;

        if (strokeCandidates.length === 0 && fillCandidatesCount === 0 && existingFinishingCountPre <= 1) {
            continue;
        }

        if (strokeCandidates.length > 0) {
            const sel = Selection.create(doc, strokeCandidates);
            doc.executeCommand(DocumentCommand.createSetSelection(sel));
            try {
                doc.executeCommand(DocumentCommand.createImportMacro(expandMacroPath));
                doc.executeCommand(DocumentCommand.createReplayMacro());
            } catch (e) {
                app.alert(M.expandMacroError(e.message, MACRO_FOLDER_NAME), APP_TITLE);
                return;
            }
        }

        if (!finishingLayer) {
            const def = ContainerNodeDefinition.create(FINAL_FINISHING_NAME);
            const builder = AddChildNodesCommandBuilder.create();
            builder.setInsertionTarget(spread);
            builder.addContainerNode(def);
            const cmd = builder.createCommand(true, NodeChildType.Main);
            doc.executeCommand(cmd);
            finishingLayer = cmd.newNodes[0];
        }
        doc.setLayerDescription(FINAL_FINISHING_NAME, finishingLayer);

        const consolidated = consolidateFinishing(spread, finishingLayer);
        const finalFinishingObjects = consolidated.finalObjects;
        totalLeftoverUnresolved += consolidated.remainingLeftoverCount;
        if (finalFinishingObjects.length > 1) totalMultiPieceCount += finalFinishingObjects.length;

        if (finalFinishingObjects.length > 0) {
            try {
                const selStyle = Selection.create(doc, finalFinishingObjects);
                doc.executeCommand(DocumentCommand.createSetSelection(selStyle));
                doc.executeCommand(DocumentCommand.createImportMacro(styleMacroPath));
                doc.executeCommand(DocumentCommand.createReplayMacro());
            } catch (e) {
                app.alert(M.styleMacroError(e.message, MACRO_FOLDER_NAME), APP_TITLE);
                return;
            }

            try {
                const selNoStroke = Selection.create(doc, finalFinishingObjects);
                doc.setPenFillDescriptor(null, selNoStroke);
            } catch (e) {}
            for (const p of finalFinishingObjects) clearStrokeWidth(p);
        }

        const unmoved = sweepSpreadIntoGraphics(spread, finishingLayer);
        allUnmovedLayerNames.push(...unmoved);

        totalCount += (strokeCandidates.length + fillCandidatesCount);
        pagesProcessed++;
        finalObjectsForSelection.push(...finalFinishingObjects);
    }

    if (pagesProcessed === 0) {
        let exampleNode = null;
        for (const n of initialSelectionNodes) {
            if (safeBool(() => n.isVectorNode)) { exampleNode = n; break; }
        }

        let exampleColour = null;
        if (exampleNode) {
            try { if (exampleNode.hasBrushFill) exampleColour = exampleNode.brushFillDescriptor.fill.colour; } catch (e) {}
            if (!exampleColour) {
                try { if (exampleNode.hasPenFill) exampleColour = exampleNode.penFillDescriptor.fill.colour; } catch (e) {}
            }
        }

        if (!exampleNode || !exampleColour) {
            app.alert(M.noObjectFound, APP_TITLE);
            return;
        }

        TARGET_CMYK = exampleColour.cmykaf;

        let exampleSpread = null;
        let n = exampleNode;
        while (n && n.parent) {
            if (n.parent[Symbol.toStringTag] === 'SpreadNode') { exampleSpread = n.parent; break; }
            n = n.parent;
        }
        if (!exampleSpread) {
            app.alert(M.noObjectFoundEvenWithSelection, APP_TITLE);
            return;
        }

        try { doc.executeCommand(DocumentCommand.createSetCurrentSpread(exampleSpread)); } catch (e) {}

        const strokeCandidates = [];
        let fillCandidatesCount = 0;
        function walk2(node) {
            if (node.isVectorNode) {
                if (hasFinishingStroke(node)) strokeCandidates.push(node);
                else if (hasFinishingFill(node)) fillCandidatesCount++;
            }
            for (const c of node.children) walk2(c);
        }
        for (const l of exampleSpread.children) {
            if (isProtectedLayer(l)) continue;
            walk2(l);
        }

        if (strokeCandidates.length === 0 && fillCandidatesCount === 0) {
            app.alert(M.noObjectFoundEvenWithSelection, APP_TITLE);
            return;
        }

        if (strokeCandidates.length > 0) {
            const sel = Selection.create(doc, strokeCandidates);
            doc.executeCommand(DocumentCommand.createSetSelection(sel));
            try {
                doc.executeCommand(DocumentCommand.createImportMacro(expandMacroPath));
                doc.executeCommand(DocumentCommand.createReplayMacro());
            } catch (e) {
                app.alert(M.expandMacroError(e.message, MACRO_FOLDER_NAME), APP_TITLE);
                return;
            }
        }

        const spreadTopLevelNow = [...exampleSpread.children];
        let finishingLayer = spreadTopLevelNow.find(l => normName(l.description) === normName(FINAL_FINISHING_NAME)) || null;
        if (!finishingLayer) {
            const def = ContainerNodeDefinition.create(FINAL_FINISHING_NAME);
            const builder = AddChildNodesCommandBuilder.create();
            builder.setInsertionTarget(exampleSpread);
            builder.addContainerNode(def);
            const cmd = builder.createCommand(true, NodeChildType.Main);
            doc.executeCommand(cmd);
            finishingLayer = cmd.newNodes[0];
        }
        doc.setLayerDescription(FINAL_FINISHING_NAME, finishingLayer);

        const consolidated = consolidateFinishing(exampleSpread, finishingLayer);
        const unitedFinishingObjects = consolidated.finalObjects;
        totalLeftoverUnresolved += consolidated.remainingLeftoverCount;
        if (unitedFinishingObjects.length > 1) totalMultiPieceCount += unitedFinishingObjects.length;

        if (unitedFinishingObjects.length === 0) {
            app.alert(M.noValidObjectAfterExpand, APP_TITLE);
            return;
        }

        try {
            const selStyle = Selection.create(doc, unitedFinishingObjects);
            doc.executeCommand(DocumentCommand.createSetSelection(selStyle));
            doc.executeCommand(DocumentCommand.createImportMacro(styleMacroPath));
            doc.executeCommand(DocumentCommand.createReplayMacro());
        } catch (e) {
            app.alert(M.styleMacroError(e.message, MACRO_FOLDER_NAME), APP_TITLE);
            return;
        }

        try {
            const selNoStroke = Selection.create(doc, unitedFinishingObjects);
            doc.setPenFillDescriptor(null, selNoStroke);
        } catch (e) {}
        for (const p of unitedFinishingObjects) clearStrokeWidth(p);

        const unmovedFallback = sweepSpreadIntoGraphics(exampleSpread, finishingLayer);
        allUnmovedLayerNames.push(...unmovedFallback);

        totalCount += (strokeCandidates.length + fillCandidatesCount);
        pagesProcessed = 1;
        finalObjectsForSelection.push(...unitedFinishingObjects);
    }

    if (finalObjectsForSelection.length > 0) {
        doc.selection = finalObjectsForSelection;
    }

    for (const spreadFinal of spreadsArr) {
        try { doc.executeCommand(DocumentCommand.createSetCurrentSpread(spreadFinal)); } catch (e) {}
        const finishingLayerFinal = [...spreadFinal.children].find(l => normName(l.description) === normName(FINAL_FINISHING_NAME)) || null;
        if (!finishingLayerFinal) continue;
        const finishingChildrenFinal = collectFinishingLayerChildren(finishingLayerFinal);
        if (finishingChildrenFinal.length === 0) continue;
        try {
            const selFinalStyle = Selection.create(doc, finishingChildrenFinal);
            doc.executeCommand(DocumentCommand.createSetSelection(selFinalStyle));
            doc.executeCommand(DocumentCommand.createImportMacro(styleMacroPath));
            doc.executeCommand(DocumentCommand.createReplayMacro());
        } catch (e) {
            app.alert(M.styleMacroError(e.message, MACRO_FOLDER_NAME), APP_TITLE);
            return;
        }
        try {
            const selFinalNoStroke = Selection.create(doc, finishingChildrenFinal);
            doc.setPenFillDescriptor(null, selFinalNoStroke);
        } catch (e) {}
        for (const p of finishingChildrenFinal) clearStrokeWidth(p);
    }

    if (spreadsArr.length > 0) {
        try { doc.executeCommand(DocumentCommand.createSetCurrentSpread(spreadsArr[0])); } catch (e) {}
    }

    let baseBody = M.doneBody(totalCount).replace('%PAGES%', pagesProcessed === 1 ? '1 pagina' : pagesProcessed + ' pagine');
    if (allUnmovedLayerNames.length > 0) {
        baseBody += M.unmovedLayers(allUnmovedLayerNames);
    }
    if (totalMultiPieceCount > 0) {
        baseBody += M.multiPieceFinishing(totalMultiPieceCount);
    }
    if (totalLeftoverUnresolved > 0) {
        baseBody += M.leftoverFinishing(totalLeftoverUnresolved);
    }

    const { Dialog, DialogResult, HorizontalAlignment } = require('/dialog');
    const dlg = Dialog.create(APP_TITLE);
    dlg.isResizable = true;
    const dlgCol = dlg.addColumn();
    const dlgMsgGroup = dlgCol.addGroup("");
    const dlgStaticText = dlgMsgGroup.addStaticText(M.doneLabel, baseBody);
    dlgStaticText.textHorizontalAlignment = HorizontalAlignment.Centre;
    const dlgNoteGroup = dlgCol.addGroup("");
    dlgNoteGroup.enableSeparator = true;
    const dlgNoteCancel = dlgNoteGroup.addStaticText("", M.buttonNoteCancel);
    dlgNoteCancel.textHorizontalAlignment = HorizontalAlignment.Centre;
    const dlgNoteOk = dlgNoteGroup.addStaticText("", M.buttonNoteOk);
    dlgNoteOk.textHorizontalAlignment = HorizontalAlignment.Centre;
    const choice = dlg.runModal();

    if (choice === DialogResult.Ok) {
        let exportSummary = '';
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
            for (const r of records.all) {
                if (!r.isSuccess) {
                    allOk = false;
                    exportSummary += '\n' + (r.errorMessage || 'sconosciuto');
                }
            }
            if (allOk) {
                exportSummary = M.exportSuccess(baseName + '_ok.pdf', EXPORT_FOLDER_NAME);
            } else {
                exportSummary = M.exportError(exportSummary);
            }
        } catch (e) {
            exportSummary = M.exportError(e.message);
        }
        app.alert(exportSummary, APP_TITLE);
    }

    } catch (e) {
        app.alert(M.genericError(e.message), APP_TITLE);
    }
})();