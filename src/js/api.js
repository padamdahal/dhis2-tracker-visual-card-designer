// ── DHIS2 REST helpers ───────────────────────────────────────────────────────

function dhis2Get(url) {
  return $.ajax({ url: config.baseUrl + url, method: 'GET', dataType: 'json' });
}
function dhis2Post(url, data) {
  return $.ajax({ url: config.baseUrl + url, method: 'POST',
    contentType: 'application/json', data: JSON.stringify(data), dataType: 'json' });
}
function dhis2Put(url, data) {
  return $.ajax({ url: config.baseUrl + url, method: 'PUT',
    contentType: 'application/json', data: JSON.stringify(data), dataType: 'json' });
}

function getPrograms() {
  return dhis2Get('/programs.json?fields=id,name&paging=false');
}

/**
 * Fetch TEAs including their optionSet (if any).
 * Returns { attrs:[{id,name,valueType}], optionSetMap:{teaUid:{id,name,options}} }
 */
function getProgramAttributes(programId) {
  return dhis2Get(
    `/programs/${programId}.json?fields=programTrackedEntityAttributes[trackedEntityAttribute[id,name,valueType,optionSet[id,name,options[code,name]]]]`
  ).then(res => {
    const raw  = res.programTrackedEntityAttributes || [];
    const attrs = raw.map(a => a.trackedEntityAttribute);
    const optionSetMap = {};
    attrs.forEach(tea => {
      if (tea.optionSet && tea.optionSet.id) optionSetMap[tea.id] = tea.optionSet;
    });
    return { attrs, optionSetMap };
  });
}

/**
 * Returns { stages:[{id,name,programStageDataElements}], optionSetMap:{deUid:{id,name,options}} }
 */
function getProgramDataElements(programId) {
  return dhis2Get(
    `/programs/${programId}.json?fields=programStages[id,name,programStageDataElements[dataElement[id,name,valueType,optionSet[id,name,options[code,name]]]]]`
  ).then(res => {
    const stages = res.programStages || [];
    const optionSetMap = {};
    stages.forEach(stage => {
      stage.programStageDataElements.forEach(psde => {
        const de = psde.dataElement;
        if (de.optionSet && de.optionSet.id) optionSetMap[de.id] = de.optionSet;
      });
    });
    return { stages, optionSetMap };
  });
}

function datastoreGetByKey(key) {
  return dhis2Get(`/dataStore/${config.datastoreNamespace}/${key}`);
}

function datastoreSaveByKey(key, payload) {
  const url = `/dataStore/${config.datastoreNamespace}/${key}`;
  return dhis2Put(url, payload).catch(err => {
    if (err.status === 404 || err.status === 409) return dhis2Post(url, payload);
    throw err;
  });
}

function datastoreListKeys() {
  return dhis2Get(`/dataStore/${config.datastoreNamespace}`);
}
