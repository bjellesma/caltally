// let changeColor = document.getElementById('changeColor');
// //get color in storage and apply it to the background of the button
// chrome.storage.sync.get('color', function(data) {
//   changeColor.style.backgroundColor = data.color;
//   changeColor.setAttribute('value', data.color);
// });
// //change color of entire page to be background color of 
// changeColor.onclick = function(element) {
//     let color = element.target.value;
//     chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
//       chrome.tabs.executeScript(
//           tabs[0].id,
//           {code: 'document.body.style.backgroundColor = "' + color + '";'});
//     });
//   };

// @ts-ignore
chrome.identity.getAuthToken({"interactive": true}, function(token){
  console.log(token);
// @ts-ignore
})