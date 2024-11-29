document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('login-btn');

  const mainContent = document.getElementById('main-content');
  const uploadArea = document.getElementById('upload-area');
  const asinSelect = document.getElementById('asin-select');
  const remarks = document.getElementById('remarks');
  const productLinkInput = document.getElementById('product-link');
  const submitBtn = document.getElementById('submit-btn');
  let selectedFile = null;

  const backendUrl = 'https://crm.tripxap.com'; // Backend URL

  // Check if user is logged in
  chrome.storage.local.get('jwtToken', function(result) {
    if (result.jwtToken) {
      // User is logged in
      loginForm.style.display = 'none';
      mainContent.style.display = 'block';
      initMainContent();
    } else {
      // User is not logged in
      loginForm.style.display = 'block';
      mainContent.style.display = 'none';
    }
  });

  // Login button click handler
  loginBtn.addEventListener('click', function() {
    const email = emailInput.value;
    const password = passwordInput.value;

    if (!email || !password) {
      alert('Please enter email and password.');
      return;
    }

    loginUser(email, password);
  });

  function loginUser(email, password) {
    fetch(`${backendUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
    })
    .then(response => {
      if (response.ok) {
        return response.json();
      } else {
        alert('Invalid email or password.');
        throw new Error('Invalid credentials');
      }
    })
    .then(data => {
      const token = data.access_token;
      chrome.storage.local.set({'jwtToken': token}, function() {
        // Logged in successfully
        loginForm.style.display = 'none';
        mainContent.style.display = 'block';
        initMainContent();
      });
    })
    .catch(error => {
      console.error('Error during login:', error);
    });
  }

  function initMainContent() {
    // Populate ASIN IDs (Replace with actual ASIN IDs)
    const asinIds = ['ASIN1', 'ASIN2', 'ASIN3']; // Add your ASIN IDs here
    asinSelect.innerHTML = '<option value="">Select ASIN ID</option>';
    asinIds.forEach(asin => {
      const option = document.createElement('option');
      option.value = asin;
      option.textContent = asin;
      asinSelect.appendChild(option);
    });

    // Get current tab URL
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      productLinkInput.value = tabs[0].url;
    });

    // Drag and drop events
    uploadArea.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.stopPropagation();
      uploadArea.classList.add('hover');
    });

    uploadArea.addEventListener('dragleave', function(e) {
      e.preventDefault();
      e.stopPropagation();
      uploadArea.classList.remove('hover');
    });

    uploadArea.addEventListener('drop', function(e) {
      e.preventDefault();
      e.stopPropagation();
      uploadArea.classList.remove('hover');
      if (e.dataTransfer.files.length > 0) {
        selectedFile = e.dataTransfer.files[0];
        displayPreview(selectedFile);
      } else {
        alert('Please drop a valid media file.');
      }
    });

    // Paste event
    uploadArea.addEventListener('paste', function(e) {
      e.preventDefault();
      e.stopPropagation();
      const items = e.clipboardData.items;
      let found = false;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const blob = item.getAsFile();
          selectedFile = new File([blob], blob.name || 'pasted_image.png', { type: blob.type });
          displayPreview(selectedFile);
          found = true;
          break;
        } else if (item.kind === 'string' && item.type === 'text/plain') {
          item.getAsString(function(str) {
            alert('Please paste an image or video file, not text.');
          });
          found = true;
        }
      }
      if (!found) {
        alert('Please paste a valid media file.');
      }
    });

    submitBtn.addEventListener('click', function() {
      if (!selectedFile) {
        alert('Please provide a media file.');
        return;
      }
      if (!asinSelect.value) {
        alert('Please select an ASIN ID.');
        return;
      }
      uploadMediaAndSaveData();
    });
  }

  function displayPreview(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      let previewElement;
      if (file.type.startsWith('image/')) {
        previewElement = document.createElement('img');
        previewElement.src = e.target.result;
        previewElement.style.maxWidth = '100%';
        previewElement.style.maxHeight = '150px';
      } else if (file.type.startsWith('video/')) {
        previewElement = document.createElement('video');
        previewElement.src = e.target.result;
        previewElement.controls = true;
        previewElement.style.maxWidth = '100%';
        previewElement.style.maxHeight = '150px';
      } else {
        alert('Unsupported file type.');
        return;
      }
      uploadArea.innerHTML = '';
      uploadArea.appendChild(previewElement);
    };
    reader.readAsDataURL(file);
  }

  function uploadMediaAndSaveData() {
    const asin = asinSelect.value;
    const remarksText = remarks.value;
    const productLink = productLinkInput.value;

    // Get JWT token from storage
    chrome.storage.local.get('jwtToken', function(result) {
      if (result.jwtToken) {
        const token = result.jwtToken;

        const formData = new FormData();
        formData.append('asin', asin);
        formData.append('remarks', remarksText);
        formData.append('product_link', productLink);
        formData.append('file', selectedFile);

        fetch(`${backendUrl}/upload-remarks/`, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token
          },
          body: formData
        })
        .then(response => {
          if (response.ok) {
            alert('Data uploaded successfully.');
            // Optionally reset the form
            resetForm();
          } else if (response.status === 401 || response.status === 403) {
            // Token might be expired or invalid
            alert('Session expired. Please log in again.');
            chrome.storage.local.remove('jwtToken', function() {
              loginForm.style.display = 'block';
              mainContent.style.display = 'none';
            });
          } else {
            response.text().then(text => {
              alert('Failed to upload data: ' + text);
            });
          }
        })
        .catch(error => {
          console.error('Error uploading data:', error);
          alert('Error uploading data.');
        });

      } else {
        alert('Not authenticated. Please log in again.');
        loginForm.style.display = 'block';
        mainContent.style.display = 'none';
      }
    });
  }

  function resetForm() {
    selectedFile = null;
    uploadArea.innerHTML = '<p>Drag & Drop or Paste Media Here</p>';
    asinSelect.value = '';
    remarks.value = '';
  }
});
