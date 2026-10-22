// Camera and microphone help, shared by the pages that use them: a clear sentence
// for each way getUserMedia fails, and a hook for when access is granted later.
//
//   await CameraHelp.explain(error, 'camera')   'camera', 'microphone', or 'camera and microphone'
//   CameraHelp.onGranted('camera', fn)          calls fn once if access is given while the page is open
//   const stop = CameraHelp.watch(show, 'camera')  while a request is pending: show('asking…'), and after a
//                                                few seconds with no answer, show(what to check); stop() when done
'use strict';

const CameraHelp = (() => {
  async function state(name) {
    try { return (await navigator.permissions.query({ name })).state; } catch (e) { return ''; }
  }

  const platform = () => (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || '';

  async function explain(e, what = 'camera') {
    const name = e && e.name;
    const thing = what === 'microphone' ? 'microphone' : what;
    const them = what === 'camera and microphone' ? 'them' : 'it';
    if (typeof window !== 'undefined' && window.isSecureContext === false)
      return 'The ' + thing + ' only works on a secure page. Open it through https:// or http://localhost, not as a file.';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
      return "This browser can't use the " + thing + ' here. Try an up-to-date Chrome, Edge, Firefox, or Safari.';
    if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
      const names = what === 'microphone' ? ['microphone'] : what === 'camera' ? ['camera'] : ['camera', 'microphone'];
      const states = await Promise.all(names.map(state));
      // the site is allowed, so the computer itself is saying no
      if (states.includes('granted')) return osBlocked(thing);
      return 'The ' + thing + (them === 'them' ? ' are' : ' is') + ' blocked for this page. Click the ' + (what === 'microphone' ? 'microphone' : 'camera') +
        ' or lock icon at the left of the address bar, choose Allow, and try again.';
    }
    if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
      if ((await state(what === 'microphone' ? 'microphone' : 'camera')) === 'granted' && /Mac/i.test(platform()))
        return 'The ' + thing + " couldn't start. Another app may be using it (Zoom, Teams, FaceTime, Photo Booth, or another tab), or macOS is blocking the browser. " + osSteps(thing);
      return 'Another app is using the ' + thing + '. Close it (for example Zoom, Teams, or another tab with a call) and try again.';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError')
      return 'No ' + thing + ' was found. Plug one in, or check that it is turned on.';
    return "Couldn't start the " + thing + (name ? ' (' + name + ')' : '') + '. Reload the page and try again.';
  }

  function osSteps(thing) {
    const p = platform();
    const pane = /microphone/.test(thing) && !/camera/.test(thing) ? 'Microphone' : 'Camera';
    if (/Mac/i.test(p)) return 'On a Mac: System Settings, Privacy & Security, ' + pane + ', turn on your browser, then quit and reopen it.';
    if (/Win/i.test(p)) return 'On Windows: Settings, Privacy & security, ' + pane + ', and turn on access for apps and desktop apps.';
    return "Check your device's privacy settings for the " + thing + '.';
  }
  function osBlocked(thing) {
    return 'Your browser allows this page, but your computer is blocking the browser from the ' + thing + '. ' + osSteps(thing);
  }

  // Calls fn once, if the permission changes to granted while the page is open.
  async function onGranted(name, fn) {
    try {
      const st = await navigator.permissions.query({ name });
      let done = false;
      st.addEventListener('change', () => { if (!done && st.state === 'granted') { done = true; fn(); } });
    } catch (e) { }
  }

  // A camera request that never answers looks like a dead button. Say that it's
  // waiting, and if it goes on, what usually causes it.
  function watch(show, what = 'camera') {
    const icon = what === 'microphone' ? 'microphone' : 'camera';
    const t1 = setTimeout(() => show('Asking for the ' + what + '. Choose Allow in the box near the address bar.'), 500);
    const t2 = setTimeout(() => show('Still waiting for the ' + what + '. If no box appeared: click the ' + icon + ' or lock icon at the left of the address bar, set ' +
      (icon === 'camera' ? 'Camera' : 'Microphone') + ' to Allow, and reload. ' + osSteps(what) + ' Also close any other app or tab using it.'), 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }

  return { explain, state, onGranted, watch };
})();
