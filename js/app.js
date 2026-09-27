import * as pdfjsLib
    from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs";


pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";


/* =====================================================
   ELEMENTS
===================================================== */

const pdfInput =
    document.getElementById("pdfInput");

const importBackup =
    document.getElementById("importBackup");

const pagesContainer =
    document.getElementById("pages");

const emptyState =
    document.getElementById("emptyState");

const viewer =
    document.getElementById("viewer");

const viewerScrollbarTrack =
    document.getElementById("viewerScrollbarTrack");

const viewerScrollbarThumb =
    document.getElementById("viewerScrollbarThumb");

const rowNumber =
    document.getElementById("rowNumber");

const plusRow =
    document.getElementById("plusRow");

const minusRow =
    document.getElementById("minusRow");

const resetRow =
    document.getElementById("resetRow");

const rotateButton =
    document.getElementById("rotateButton");

const drawButton =
    document.getElementById("drawButton");

const previousPage =
    document.getElementById("previousPage");

const nextPage =
    document.getElementById("nextPage");

const clearPage =
    document.getElementById("clearPage");

const exportButton =
    document.getElementById("exportButton");

const deleteButton =
    document.getElementById("deleteButton");

const drawingTools =
    document.getElementById("drawingTools");

const penButton =
    document.getElementById("penButton");

const eraserButton =
    document.getElementById("eraserButton");

const closeDrawing =
    document.getElementById("closeDrawing");

const penColor =
    document.getElementById("penColor");

const brushSize =
    document.getElementById("brushSize");

const saveStatus =
    document.getElementById("saveStatus");


/* =====================================================
   APPLICATION STATE
===================================================== */

let pdfDocument = null;

let totalPages = 0;

let currentPage = 1;

let row = 1;

let drawingEnabled = false;

let eraserEnabled = false;

let currentFileName = "";

let pdfBytes = null;

let pageCanvases = [];

let drawingCanvases = [];

let viewerZoom = 1;

let pinchStartDistance = 0;

let pinchStartZoom = 1;

let pinchPageAnchor = null;


/* =====================================================
   INDEXEDDB
===================================================== */

const DB_NAME =
    "KnittingPatternTracker";

const DB_VERSION = 1;

const STORE_NAME =
    "projects";


let database;


function openDatabase() {

    return new Promise(
        (resolve, reject) => {

            const request =
                indexedDB.open(
                    DB_NAME,
                    DB_VERSION
                );


            request.onupgradeneeded =
                () => {

                    const db =
                        request.result;

                    if (
                        !db.objectStoreNames.contains(
                            STORE_NAME
                        )
                    ) {

                        db.createObjectStore(
                            STORE_NAME
                        );

                    }

                };


            request.onsuccess =
                () => {

                    database =
                        request.result;

                    resolve(database);

                };


            request.onerror =
                () => {

                    reject(
                        request.error
                    );

                };

        }
    );

}


function databasePut(
    key,
    value
) {

    return new Promise(
        (resolve, reject) => {

            const transaction =
                database.transaction(
                    STORE_NAME,
                    "readwrite"
                );

            const store =
                transaction.objectStore(
                    STORE_NAME
                );

            store.put(
                value,
                key
            );

            transaction.oncomplete =
                () => resolve();

            transaction.onerror =
                () => reject(
                    transaction.error
                );

        }
    );

}


function databaseGet(key) {

    return new Promise(
        (resolve, reject) => {

            const transaction =
                database.transaction(
                    STORE_NAME,
                    "readonly"
                );

            const store =
                transaction.objectStore(
                    STORE_NAME
                );

            const request =
                store.get(key);

            request.onsuccess =
                () => resolve(
                    request.result
                );

            request.onerror =
                () => reject(
                    request.error
                );

        }
    );

}


function databaseDelete(key) {

    return new Promise(
        (resolve, reject) => {

            const transaction =
                database.transaction(
                    STORE_NAME,
                    "readwrite"
                );

            const store =
                transaction.objectStore(
                    STORE_NAME
                );

            store.delete(key);

            transaction.oncomplete =
                () => resolve();

            transaction.onerror =
                () => reject(
                    transaction.error
                );

        }
    );

}


/* =====================================================
   SAVE INDICATOR
===================================================== */

let saveTimer;


function showSaved() {

    saveStatus.classList.add(
        "visible"
    );

    clearTimeout(saveTimer);

    saveTimer =
        setTimeout(() => {

            saveStatus.classList.remove(
                "visible"
            );

        }, 1000);

}


/* =====================================================
   CAPTURE DRAWING DATA
===================================================== */

function getAnnotations() {

    return drawingCanvases.map(
        canvas => canvas.toDataURL(
            "image/png"
        )
    );

}


/* =====================================================
   SAVE COMPLETE PROJECT
===================================================== */

async function saveProject() {

    if (!database) {
        return;
    }

    if (!pdfBytes) {
        return;
    }


    try {

        const project = {

            version: 1,

            fileName:
                currentFileName,

            pdfBytes:
                pdfBytes,

            row:
                row,

            annotations:
                getAnnotations(),

            savedAt:
                new Date().toISOString()

        };


        await databasePut(
            "currentProject",
            project
        );


        showSaved();

    } catch (error) {

        console.error(
            "Could not save project:",
            error
        );

    }

}


/* =====================================================
   ROW COUNTER
===================================================== */

function updateRowDisplay() {

    rowNumber.textContent =
        row;

}


plusRow.addEventListener(
    "click",
    async () => {

        row++;

        updateRowDisplay();

        await saveProject();

    }
);


minusRow.addEventListener(
    "click",
    async () => {

        if (row > 1) {

            row--;

        }

        updateRowDisplay();

        await saveProject();

    }
);


resetRow.addEventListener(
    "click",
    async () => {

        row = 1;

        updateRowDisplay();

        await saveProject();

    }
);


/* =====================================================
   ROTATION
===================================================== */

rotateButton.addEventListener(
    "click",
    () => {

        document.body.classList.toggle(
            "landscape-mode"
        );

    }
);


/* =====================================================
   IMPORT PDF
===================================================== */

pdfInput.addEventListener(
    "change",
    async event => {

        const file =
            event.target.files[0];

        if (!file) {
            return;
        }


        if (
            file.type !==
            "application/pdf"
        ) {

            alert(
                "Please choose a PDF pattern."
            );

            return;

        }


        try {

            const buffer =
                await file.arrayBuffer();


            pdfBytes =
                new Uint8Array(buffer);


            currentFileName =
                file.name;


            row = 1;

            updateRowDisplay();


            await loadPDF(
                pdfBytes
            );


            await saveProject();


        } catch (error) {

            console.error(error);

            alert(
                "There was a problem loading the PDF."
            );

        }

    }
);


/* =====================================================
   LOAD PDF
===================================================== */

async function loadPDF(
    bytes,
    savedAnnotations = []
) {

    pdfDocument =
        await pdfjsLib.getDocument({
            data: bytes
        }).promise;


    totalPages =
        pdfDocument.numPages;


    currentPage = 1;

    viewerZoom = 1;
    pinchStartDistance = 0;
    pinchPageAnchor = null;

    document.body.classList.remove(
        "zoomed"
    );

    viewer.scrollLeft = 0;


    pageCanvases = [];

    drawingCanvases = [];


    pagesContainer.innerHTML = "";

    emptyState.style.display =
        "none";


    for (
        let pageNumber = 1;
        pageNumber <= totalPages;
        pageNumber++
    ) {

        await renderPage(
            pageNumber,
            savedAnnotations[
                pageNumber - 1
            ]
        );

    }


    scrollToPage(1);

}


/* =====================================================
   RENDER PDF PAGE
===================================================== */

async function renderPage(
    pageNumber,
    savedAnnotation
) {

    const page =
        await pdfDocument.getPage(
            pageNumber
        );


    const viewport =
        page.getViewport({
            scale: 1.5
        });


    const pageWrapper =
        document.createElement(
            "div"
        );

    pageWrapper.className =
        "page-wrapper";

    pageWrapper.dataset.page =
        pageNumber;


    const pdfCanvas =
        document.createElement(
            "canvas"
        );

    pdfCanvas.className =
        "pdf-page";

    pdfCanvas.width =
        viewport.width;

    pdfCanvas.height =
        viewport.height;


    const drawingCanvas =
        document.createElement(
            "canvas"
        );

    drawingCanvas.className =
        "drawing-canvas";

    drawingCanvas.width =
        viewport.width;

    drawingCanvas.height =
        viewport.height;


    const pageLabel =
        document.createElement(
            "div"
        );

    pageLabel.className =
        "page-number";

    pageLabel.textContent =
        `${pageNumber} / ${totalPages}`;


    pageWrapper.appendChild(
        pdfCanvas
    );

    pageWrapper.appendChild(
        drawingCanvas
    );

    pageWrapper.appendChild(
        pageLabel
    );


    pagesContainer.appendChild(
        pageWrapper
    );


    const maxWidth =
        Math.min(
            window.innerWidth - 16,
            900
        );


    pageWrapper.style.width =
        `${Math.min(
            viewport.width,
            maxWidth
        )}px`;

    pageWrapper.dataset.baseWidth =
        pageWrapper.getBoundingClientRect().width;


    const context =
        pdfCanvas.getContext(
            "2d"
        );


    await page.render({

        canvasContext:
            context,

        viewport:
            viewport

    }).promise;


    pageCanvases.push(
        pdfCanvas
    );

    drawingCanvases.push(
        drawingCanvas
    );


    setupDrawingCanvas(
        drawingCanvas
    );


    /*
     * Restore saved annotation.
     */

    if (savedAnnotation) {

        await restoreAnnotation(
            drawingCanvas,
            savedAnnotation
        );

    }

}


/* =====================================================
   RESTORE ANNOTATION
===================================================== */

function restoreAnnotation(
    canvas,
    dataURL
) {

    return new Promise(
        resolve => {

            const image =
                new Image();

            image.onload =
                () => {

                    const context =
                        canvas.getContext(
                            "2d"
                        );

                    context.drawImage(
                        image,
                        0,
                        0,
                        canvas.width,
                        canvas.height
                    );

                    resolve();

                };

            image.onerror =
                () => resolve();

            image.src =
                dataURL;

        }
    );

}


/* =====================================================
   DRAWING
===================================================== */

function setupDrawingCanvas(
    canvas
) {

    const context =
        canvas.getContext("2d");


    let drawing = false;

    let lastX = 0;

    let lastY = 0;


    function getPosition(event) {

        const rect =
            canvas.getBoundingClientRect();


        const scaleX =
            canvas.width /
            rect.width;


        const scaleY =
            canvas.height /
            rect.height;


        return {

            x:
                (event.clientX -
                 rect.left) *
                scaleX,

            y:
                (event.clientY -
                 rect.top) *
                scaleY

        };

    }


    function startDrawing(event) {

        if (!drawingEnabled) {
            return;
        }


        event.preventDefault();


        try {

            canvas.setPointerCapture(
                event.pointerId
            );

        } catch (_) {}


        drawing = true;


        const position =
            getPosition(event);


        lastX =
            position.x;

        lastY =
            position.y;


        context.beginPath();

        context.arc(
            lastX,
            lastY,
            getBrushSize() / 2,
            0,
            Math.PI * 2
        );


        if (eraserEnabled) {

            context.globalCompositeOperation =
                "destination-out";

        } else {

            context.globalCompositeOperation =
                "source-over";

            context.fillStyle =
                penColor.value;

        }


        context.fill();

    }


    function draw(event) {

        if (
            !drawing ||
            !drawingEnabled
        ) {
            return;
        }


        event.preventDefault();


        const position =
            getPosition(event);


        context.beginPath();

        context.moveTo(
            lastX,
            lastY
        );

        context.lineTo(
            position.x,
            position.y
        );


        context.lineWidth =
            getBrushSize();

        context.lineCap =
            "round";

        context.lineJoin =
            "round";


        if (eraserEnabled) {

            context.globalCompositeOperation =
                "destination-out";

        } else {

            context.globalCompositeOperation =
                "source-over";

            context.strokeStyle =
                penColor.value;

        }


        context.stroke();


        lastX =
            position.x;

        lastY =
            position.y;

    }


    async function stopDrawing(event) {

        if (event) {

            event.preventDefault();

        }


        if (!drawing) {
            return;
        }


        drawing = false;


        try {

            canvas.releasePointerCapture(
                event.pointerId
            );

        } catch (_) {}


        /*
         * Save immediately after a completed
         * stroke.
         */

        await saveProject();

    }


    canvas.addEventListener(
        "pointerdown",
        startDrawing
    );

    canvas.addEventListener(
        "pointermove",
        draw
    );

    canvas.addEventListener(
        "pointerup",
        stopDrawing
    );

    canvas.addEventListener(
        "pointercancel",
        stopDrawing
    );

}


function getBrushSize() {

    return Number(
        brushSize.value
    ) * (eraserEnabled ? 4 : 1);

}


/* =====================================================
   DRAWING MODE
===================================================== */

drawButton.addEventListener(
    "click",
    () => {

        drawingEnabled =
            !drawingEnabled;

        document.body.classList.toggle(
            "drawing-mode",
            drawingEnabled
        );

        drawingTools.classList.toggle(
            "visible",
            drawingEnabled
        );


        drawButton.classList.toggle(
            "active",
            drawingEnabled
        );

    }
);


closeDrawing.addEventListener(
    "click",
    () => {

        drawingEnabled =
            false;

        document.body.classList.remove(
            "drawing-mode"
        );

        drawingTools.classList.remove(
            "visible"
        );

        drawButton.classList.remove(
            "active"
        );

    }
);


/* =====================================================
   PEN / ERASER
===================================================== */

penButton.addEventListener(
    "click",
    () => {

        eraserEnabled =
            false;

        penButton.classList.add(
            "active"
        );

        eraserButton.classList.remove(
            "active"
        );

    }
);


eraserButton.addEventListener(
    "click",
    () => {

        eraserEnabled =
            true;

        eraserButton.classList.add(
            "active"
        );

        penButton.classList.remove(
            "active"
        );

    }
);


/* =====================================================
   CLEAR CURRENT PAGE
===================================================== */

clearPage.addEventListener(
    "click",
    async () => {

        const canvas =
            drawingCanvases[
                currentPage - 1
            ];


        if (!canvas) {
            return;
        }


        const context =
            canvas.getContext(
                "2d"
            );


        context.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );


        await saveProject();

    }
);


/* =====================================================
   PAGE NAVIGATION
===================================================== */

previousPage.addEventListener(
    "click",
    () => {

        if (!pdfDocument) {
            return;
        }


        currentPage =
            Math.max(
                1,
                currentPage - 1
            );


        scrollToPage(
            currentPage
        );

    }
);


nextPage.addEventListener(
    "click",
    () => {

        if (!pdfDocument) {
            return;
        }


        currentPage =
            Math.min(
                totalPages,
                currentPage + 1
            );


        scrollToPage(
            currentPage
        );

    }
);


function scrollToPage(
    pageNumber
) {

    const page =
        document.querySelector(
            `.page-wrapper[data-page="${pageNumber}"]`
        );


    if (!page) {
        return;
    }


    page.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}


function getTouchDistance(
    firstTouch,
    secondTouch
) {

    return Math.hypot(
        secondTouch.clientX - firstTouch.clientX,
        secondTouch.clientY - firstTouch.clientY
    );

}


function getPinchPageAnchor(
    clientX,
    clientY
) {

    const pageWrapper =
        document.elementFromPoint(
            clientX,
            clientY
        )?.closest(
            ".page-wrapper"
        );

    if (!pageWrapper) {
        return null;
    }


    const rect =
        pageWrapper.getBoundingClientRect();

    return {
        pageWrapper,
        x: (clientX - rect.left) / rect.width,
        y: (clientY - rect.top) / rect.height
    };

}


function setViewerZoom(
    zoom,
    focalX,
    focalY
) {

    const nextZoom =
        Math.min(
            4,
            Math.max(1, zoom)
        );

    if (nextZoom === viewerZoom) {
        return;
    }


    viewerZoom = nextZoom;

    document.body.classList.toggle(
        "zoomed",
        viewerZoom > 1
    );


    document.querySelectorAll(
        ".page-wrapper"
    ).forEach(
        pageWrapper => {

            const baseWidth =
                Number(
                    pageWrapper.dataset.baseWidth
                );

            pageWrapper.style.width =
                `${baseWidth * viewerZoom}px`;

        }
    );


    if (pinchPageAnchor) {

        const pageRect =
            pinchPageAnchor.pageWrapper
                .getBoundingClientRect();

        viewer.scrollLeft +=
            pageRect.left +
            pageRect.width * pinchPageAnchor.x -
            focalX;

        viewer.scrollTop +=
            pageRect.top +
            pageRect.height * pinchPageAnchor.y -
            focalY;

    }


    updateViewerScrollbar();

}


viewer.addEventListener(
    "touchstart",
    event => {

        if (
            drawingEnabled ||
            event.touches.length !== 2
        ) {
            return;
        }


        const firstTouch =
            event.touches[0];

        const secondTouch =
            event.touches[1];

        const midpointX =
            (firstTouch.clientX + secondTouch.clientX) / 2;

        const midpointY =
            (firstTouch.clientY + secondTouch.clientY) / 2;

        pinchStartDistance =
            getTouchDistance(
                firstTouch,
                secondTouch
            );

        pinchStartZoom =
            viewerZoom;

        pinchPageAnchor =
            getPinchPageAnchor(
                midpointX,
                midpointY
            );

    },
    { passive: true }
);


viewer.addEventListener(
    "touchmove",
    event => {

        if (
            drawingEnabled ||
            event.touches.length !== 2 ||
            pinchStartDistance === 0
        ) {
            return;
        }


        event.preventDefault();


        const firstTouch =
            event.touches[0];

        const secondTouch =
            event.touches[1];

        const midpointX =
            (firstTouch.clientX + secondTouch.clientX) / 2;

        const midpointY =
            (firstTouch.clientY + secondTouch.clientY) / 2;

        setViewerZoom(
            pinchStartZoom *
                getTouchDistance(
                    firstTouch,
                    secondTouch
                ) /
                pinchStartDistance,
            midpointX,
            midpointY
        );

    },
    { passive: false }
);


function endPinch(event) {

    if (event.touches.length < 2) {
        pinchStartDistance = 0;
        pinchPageAnchor = null;
    }

}


viewer.addEventListener(
    "touchend",
    endPinch,
    { passive: true }
);

viewer.addEventListener(
    "touchcancel",
    endPinch,
    { passive: true }
);


/* =====================================================
   DETECT CURRENT PAGE
===================================================== */

let scrollTimeout;

function updateViewerScrollbar() {

    const trackHeight =
        viewerScrollbarTrack.clientHeight;

    if (!trackHeight) {
        return;
    }

    const scrollableDistance =
        Math.max(
            0,
            viewer.scrollHeight - viewer.clientHeight
        );

    viewerScrollbarTrack.classList.toggle(
        "visible",
        scrollableDistance > 0
    );

    const thumbHeight =
        scrollableDistance > 0
            ? Math.min(
                trackHeight,
                Math.max(
                    36,
                    trackHeight *
                    viewer.clientHeight /
                    viewer.scrollHeight
                )
            )
            : trackHeight;

    const thumbRange =
        trackHeight - thumbHeight;

    const thumbTop =
        scrollableDistance > 0
            ? viewer.scrollTop /
                scrollableDistance *
                thumbRange
            : 0;

    viewerScrollbarThumb.style.height =
        `${thumbHeight}px`;

    viewerScrollbarThumb.style.transform =
        `translateY(${thumbTop}px)`;

    viewerScrollbarThumb.setAttribute(
        "aria-valuemax",
        String(scrollableDistance)
    );

    viewerScrollbarThumb.setAttribute(
        "aria-valuenow",
        String(Math.round(viewer.scrollTop))
    );

}


let scrollbarDragStartY = 0;

let scrollbarDragStartTop = 0;


viewerScrollbarTrack.addEventListener(
    "pointerdown",
    event => {

        if (
            event.target ===
            viewerScrollbarThumb
        ) {
            return;
        }

        const trackRect =
            viewerScrollbarTrack
                .getBoundingClientRect();

        const thumbHeight =
            viewerScrollbarThumb.offsetHeight;

        const thumbRange =
            trackRect.height - thumbHeight;

        const scrollableDistance =
            viewer.scrollHeight - viewer.clientHeight;

        if (
            thumbRange <= 0 ||
            scrollableDistance <= 0
        ) {
            return;
        }

        const thumbTop =
            Math.min(
                thumbRange,
                Math.max(
                    0,
                    event.clientY -
                    trackRect.top -
                    thumbHeight / 2
                )
            );

        viewer.scrollTop =
            thumbTop /
            thumbRange *
            scrollableDistance;

    }
);


viewerScrollbarThumb.addEventListener(
    "pointerdown",
    event => {

        event.preventDefault();

        const trackRect =
            viewerScrollbarTrack
                .getBoundingClientRect();

        const thumbRect =
            viewerScrollbarThumb
                .getBoundingClientRect();

        scrollbarDragStartY =
            event.clientY;

        scrollbarDragStartTop =
            thumbRect.top - trackRect.top;

        viewerScrollbarThumb.setPointerCapture(
            event.pointerId
        );

    }
);


viewerScrollbarThumb.addEventListener(
    "pointermove",
    event => {

        if (
            !viewerScrollbarThumb
                .hasPointerCapture(event.pointerId)
        ) {
            return;
        }

        const trackHeight =
            viewerScrollbarTrack.clientHeight;

        const thumbHeight =
            viewerScrollbarThumb.offsetHeight;

        const thumbRange =
            trackHeight - thumbHeight;

        const scrollableDistance =
            viewer.scrollHeight - viewer.clientHeight;

        if (
            thumbRange <= 0 ||
            scrollableDistance <= 0
        ) {
            return;
        }

        const thumbTop =
            Math.min(
                thumbRange,
                Math.max(
                    0,
                    scrollbarDragStartTop +
                    event.clientY -
                    scrollbarDragStartY
                )
            );

        viewer.scrollTop =
            thumbTop /
            thumbRange *
            scrollableDistance;

    }
);


viewerScrollbarThumb.addEventListener(
    "pointerup",
    event => {

        if (
            viewerScrollbarThumb
                .hasPointerCapture(event.pointerId)
        ) {
            viewerScrollbarThumb.releasePointerCapture(
                event.pointerId
            );
        }

    }
);


viewerScrollbarThumb.addEventListener(
    "keydown",
    event => {

        const pageStep =
            event.key === "PageDown" ||
            event.key === "PageUp";

        if (
            event.key === "ArrowDown" ||
            event.key === "PageDown"
        ) {
            viewer.scrollTop +=
                pageStep
                    ? viewer.clientHeight
                    : 50;
        } else if (
            event.key === "ArrowUp" ||
            event.key === "PageUp"
        ) {
            viewer.scrollTop -=
                pageStep
                    ? viewer.clientHeight
                    : 50;
        } else if (event.key === "Home") {
            viewer.scrollTop = 0;
        } else if (event.key === "End") {
            viewer.scrollTop =
                viewer.scrollHeight;
        } else {
            return;
        }

        event.preventDefault();

    }
);


const viewerResizeObserver =
    new ResizeObserver(
        updateViewerScrollbar
    );

viewerResizeObserver.observe(viewer);
viewerResizeObserver.observe(pagesContainer);

window.addEventListener(
    "resize",
    updateViewerScrollbar
);

updateViewerScrollbar();


viewer.addEventListener(
    "scroll",
    () => {

        updateViewerScrollbar();

        clearTimeout(
            scrollTimeout
        );


        scrollTimeout =
            setTimeout(
                () => {

                    const pageElements =
                        document.querySelectorAll(
                            ".page-wrapper"
                        );


                    let closestPage =
                        1;

                    let closestDistance =
                        Infinity;


                    pageElements.forEach(
                        pageElement => {

                            const rect =
                                pageElement
                                    .getBoundingClientRect();


                            const viewerRect =
                                viewer
                                    .getBoundingClientRect();


                            const distance =
                                Math.abs(
                                    rect.top -
                                    viewerRect.top -
                                    20
                                );


                            if (
                                distance <
                                closestDistance
                            ) {

                                closestDistance =
                                    distance;

                                closestPage =
                                    Number(
                                        pageElement
                                            .dataset
                                            .page
                                    );

                            }

                        }
                    );


                    currentPage =
                        closestPage;

                },
                100
            );

    }
);


/* =====================================================
   DELETE PROJECT
===================================================== */

deleteButton.addEventListener(
    "click",
    async () => {

        if (!pdfBytes) {

            alert(
                "There is no saved project."
            );

            return;

        }


        const confirmed =
            confirm(
                "Delete the saved knitting project and all annotations?"
            );


        if (!confirmed) {
            return;
        }


        await databaseDelete(
            "currentProject"
        );


        pdfDocument = null;

        pdfBytes = null;

        currentFileName = "";

        totalPages = 0;

        currentPage = 1;

        row = 1;

        pageCanvases = [];

        drawingCanvases = [];


        pagesContainer.innerHTML =
            "";

        emptyState.style.display =
            "flex";


        updateRowDisplay();

    }
);


/* =====================================================
   EXPORT BACKUP
===================================================== */

exportButton.addEventListener(
    "click",
    async () => {

        if (!pdfBytes) {

            alert(
                "There is no knitting project to back up."
            );

            return;

        }


        /*
         * Make sure the most recent drawing is included.
         */

        await saveProject();


        const project =
            await databaseGet(
                "currentProject"
            );


        if (!project) {
            return;
        }


        /*
         * Convert the Uint8Array into a normal
         * array so JSON can store it.
         */

        const backup = {

            version:
                project.version,

            fileName:
                project.fileName,

            pdfBytes:
                Array.from(
                    project.pdfBytes
                ),

            row:
                project.row,

            annotations:
                project.annotations,

            savedAt:
                project.savedAt

        };


        const blob =
            new Blob(
                [
                    JSON.stringify(
                        backup
                    )
                ],
                {
                    type:
                        "application/json"
                }
            );


        const url =
            URL.createObjectURL(
                blob
            );


        const link =
            document.createElement(
                "a"
            );


        link.href =
            url;


        link.download =
            (
                currentFileName
                    .replace(
                        /\.pdf$/i,
                        ""
                    ) ||
                "knitting-project"
            ) +
            ".knitpattern";


        document.body.appendChild(
            link
        );


        link.click();


        link.remove();


        URL.revokeObjectURL(
            url
        );

    }
);


/* =====================================================
   IMPORT BACKUP
===================================================== */

importBackup.addEventListener(
    "change",
    async event => {

        const file =
            event.target.files[0];


        if (!file) {
            return;
        }


        try {

            const text =
                await file.text();


            const backup =
                JSON.parse(text);


            if (
                !backup ||
                !backup.pdfBytes ||
                !Array.isArray(
                    backup.pdfBytes
                )
            ) {

                throw new Error(
                    "Invalid backup"
                );

            }


            const bytes =
                new Uint8Array(
                    backup.pdfBytes
                );


            pdfBytes =
                bytes;


            currentFileName =
                backup.fileName ||
                "knitting-pattern.pdf";


            row =
                Number(
                    backup.row
                ) || 1;


            updateRowDisplay();


            await loadPDF(
                bytes,
                backup.annotations || []
            );


            await saveProject();


            alert(
                "Knitting project restored."
            );


        } catch (error) {

            console.error(error);

            alert(
                "That backup file could not be loaded."
            );

        }


        /*
         * Allows the same backup file to be
         * selected again later.
         */

        event.target.value = "";

    }
);


/* =====================================================
   RESTORE AUTOMATICALLY ON STARTUP
===================================================== */

async function restoreSavedProject() {

    try {

        await openDatabase();


        const project =
            await databaseGet(
                "currentProject"
            );


        if (!project) {
            return;
        }


        if (!project.pdfBytes) {
            return;
        }


        pdfBytes =
            project.pdfBytes instanceof
            Uint8Array

                ? project.pdfBytes

                : new Uint8Array(
                    project.pdfBytes
                );


        currentFileName =
            project.fileName ||
            "knitting-pattern.pdf";


        row =
            Number(
                project.row
            ) || 1;


        updateRowDisplay();


        await loadPDF(
            pdfBytes,
            project.annotations || []
        );


    } catch (error) {

        console.error(
            "Could not restore project:",
            error
        );

    }

}


/* =====================================================
   RESIZE
===================================================== */

window.addEventListener(
    "resize",
    () => {

        const maxWidth =
            Math.min(
                window.innerWidth - 16,
                900
            );


        document
            .querySelectorAll(
                ".page-wrapper"
            )
            .forEach(page => {

                const canvas =
                    page.querySelector(
                        ".pdf-page"
                    );


                if (!canvas) {
                    return;
                }


                page.style.width =
                    `${Math.min(
                        canvas.width,
                        maxWidth
                    )}px`;

            });

    }
);


/* =====================================================
   KEYBOARD
===================================================== */

document.addEventListener(
    "keydown",
    event => {

        if (event.key === "+") {

            plusRow.click();

        }


        if (event.key === "-") {

            minusRow.click();

        }


        if (
            event.key ===
            "ArrowRight"
        ) {

            nextPage.click();

        }


        if (
            event.key ===
            "ArrowLeft"
        ) {

            previousPage.click();

        }

    }
);


/* =====================================================
   START APPLICATION
===================================================== */

updateRowDisplay();

restoreSavedProject();