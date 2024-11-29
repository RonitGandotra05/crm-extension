document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const loginForm = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('login-btn');
  const loginLoader = document.getElementById('login-loader');

  const mainContent = document.getElementById('main-content');
  const uploadArea = document.getElementById('upload-area');
  const asinInput = document.getElementById('asin-input');
  const asinDatalist = document.getElementById('asin-datalist');
  const skuIdInput = document.getElementById('sku-id');
  const imageLinkInput = document.getElementById('image-link');
  const imagePreviewDiv = document.getElementById('image-preview');
  const imagePreviewImg = document.getElementById('image-preview-img');
  const remarksInput = document.getElementById('remarks');
  const productLinkInput = document.getElementById('product-link');
  const submitBtn = document.getElementById('submit-btn');
  const submitLoader = document.getElementById('submit-loader');

  const logoutBtn = document.getElementById('logout-btn');
  const logoutLoader = document.getElementById('logout-loader');

  let selectedFile = null;
  let asinInfoData = []; // To store asin_info fetched from backend
  const backendUrl = 'http://localhost:8080'; // Update to your local backend URL

  /**
   * Initialize the extension by checking authentication status.
   */
  function initialize() {
    chrome.storage.local.get('jwtToken', (result) => {
      if (result.jwtToken) {
        showMainContent();
        initializeMainContent();
      } else {
        showLoginForm();
      }
    });
  }

  /**
   * Display the login form and hide the main content.
   */
  function showLoginForm() {
    loginForm.classList.remove('hidden');
    mainContent.classList.add('hidden');
  }

  /**
   * Display the main content and hide the login form.
   */
  function showMainContent() {
    loginForm.classList.add('hidden');
    mainContent.classList.remove('hidden');
  }

  /**
   * Show loader and disable button.
   * @param {HTMLElement} loader - The loader element to show.
   * @param {HTMLElement} button - The button to disable.
   */
  function showLoader(loader, button) {
    loader.style.display = 'block';
    button.disabled = true;
  }

  /**
   * Hide loader and enable button.
   * @param {HTMLElement} loader - The loader element to hide.
   * @param {HTMLElement} button - The button to enable.
   */
  function hideLoader(loader, button) {
    loader.style.display = 'none';
    button.disabled = false;
  }

  /**
   * Handle user login.
   */
  function handleLogin() {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
      alert('Please enter both email and password.');
      return;
    }

    // Show loader and disable login button
    showLoader(loginLoader, loginBtn);

    // Prepare form data
    const formData = new URLSearchParams();
    formData.append('email', email);
    formData.append('password', password);

    // Send login request
    fetch(`${backendUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Invalid email or password.');
        }
        return response.json();
      })
      .then((data) => {
        const token = data.access_token;
        if (token) {
          // Store JWT token
          chrome.storage.local.set({ jwtToken: token }, () => {
            hideLoader(loginLoader, loginBtn);
            showMainContent();
            initializeMainContent();
          });
        } else {
          throw new Error('Authentication token not received.');
        }
      })
      .catch((error) => {
        hideLoader(loginLoader, loginBtn);
        console.error('Login Error:', error);
        alert(error.message);
      });
  }

  /**
   * Initialize the main content after successful login.
   */
  function initializeMainContent() {
    populateASINOptions();
    fetchCurrentTabURL();
    setupUploadAreaEvents();
    submitBtn.addEventListener('click', handleSubmit);
    logoutBtn.addEventListener('click', handleLogout);
    asinInput.addEventListener('input', handleASINInput);
  }

  /**
   * Populate ASIN IDs into the datalist.
   * Fetches asin_info from the backend and populates the datalist.
   */
  function populateASINOptions() {
    // Retrieve JWT token from storage
    chrome.storage.local.get('jwtToken', (result) => {
      const token = result.jwtToken;
      if (!token) {
        alert('Not authenticated. Please log in again.');
        showLoginForm();
        return;
      }

      // Fetch asin_info from backend
      fetch(`${backendUrl}/get-asin-info/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error('Failed to fetch ASIN information.');
          }
          return response.json();
        })
        .then((data) => {
          asinInfoData = data.asin_info;
          if (asinInfoData.length === 0) {
            alert('No ASIN information available.');
            return;
          }

          // Clear existing options
          asinDatalist.innerHTML = '';

          // Populate new options
          asinInfoData.forEach((asin) => {
            const option = document.createElement('option');
            option.value = asin.asin_id;
            asinDatalist.appendChild(option);
          });
        })
        .catch((error) => {
          console.error('Error fetching ASIN info:', error);
          alert(error.message);
        });
    });
  }

  /**
   * Handle ASIN input changes.
   * Updates SKU ID and Image Link fields based on entered ASIN ID.
   */
  function handleASINInput() {
    const enteredASIN = asinInput.value.trim();

    if (!enteredASIN) {
      // If input is empty, clear the fields
      skuIdInput.value = '';
      imageLinkInput.value = '';
      imagePreviewImg.src = '';
      imagePreviewDiv.classList.add('hidden');
      return;
    }

    // Find the entered asin info
    const asinInfo = asinInfoData.find((asin) => asin.asin_id === enteredASIN);

    if (asinInfo) {
      skuIdInput.value = asinInfo.sku_id;
      imageLinkInput.value = asinInfo.image_link;
      imagePreviewImg.src = asinInfo.image_link;
      imagePreviewDiv.classList.remove('hidden');
    } else {
      // If asin_id not found in data, clear the fields
      skuIdInput.value = '';
      imageLinkInput.value = '';
      imagePreviewImg.src = '';
      imagePreviewDiv.classList.add('hidden');
      // Optionally, alert the user
      // alert('Entered ASIN ID not found.');
    }
  }

  /**
   * Fetch and display the current tab's URL in the product link input.
   */
  function fetchCurrentTabURL() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url) {
        productLinkInput.value = tabs[0].url;
      }
    });
  }

  /**
   * Setup drag-and-drop and paste event listeners for the upload area.
   */
  function setupUploadAreaEvents() {
    // Prevent default behavior for drag events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((event) => {
      uploadArea.addEventListener(event, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    // Highlight upload area on drag over
    uploadArea.addEventListener('dragover', () => {
      uploadArea.classList.add('hover');
    });

    // Remove highlight when drag leaves
    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('hover');
    });

    // Handle file drop
    uploadArea.addEventListener('drop', (e) => {
      uploadArea.classList.remove('hover');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelection(files[0]);
      } else {
        alert('Please drop a valid media file.');
      }
    });

    // Handle paste event
    uploadArea.addEventListener('paste', (e) => {
      const items = e.clipboardData.items;
      let fileFound = false;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const blob = item.getAsFile();
          handleFileSelection(new File([blob], blob.name || 'pasted_media', { type: blob.type }));
          fileFound = true;
          break;
        } else if (item.kind === 'string' && item.type === 'text/plain') {
          item.getAsString((str) => {
            alert('Please paste an image or video file, not text.');
          });
          fileFound = true;
          break;
        }
      }

      if (!fileFound) {
        alert('Please paste a valid media file.');
      }
    });
  }

  /**
   * Handle the selected or dropped file.
   * @param {File} file - The selected media file.
   */
  function handleFileSelection(file) {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      alert('Unsupported file type. Please upload an image or video.');
      return;
    }

    selectedFile = file;
    displayMediaPreview(file);
  }

  /**
   * Display a preview of the selected media file.
   * @param {File} file - The media file to preview.
   */
  function displayMediaPreview(file) {
    const reader = new FileReader();

    reader.onload = (e) => {
      uploadArea.innerHTML = ''; // Clear previous content

      if (file.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.alt = 'Uploaded Image';
        uploadArea.appendChild(img);
      } else if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.src = e.target.result;
        video.controls = true;
        uploadArea.appendChild(video);
      }
    };

    reader.readAsDataURL(file);
  }

  /**
   * Handle the form submission to upload media and save data.
   */
  function handleSubmit() {
    // Validate inputs
    if (!selectedFile) {
      alert('Please provide a media file.');
      return;
    }

    const asin = asinInput.value.trim();
    const remarksText = remarksInput.value.trim();
    const productLink = productLinkInput.value.trim();

    if (!asin) {
      alert('Please select an ASIN ID.');
      return;
    }

    if (!remarksText) {
      alert('Please enter remarks.');
      return;
    }

    // Show loader and disable submit button
    showLoader(submitLoader, submitBtn);

    // Retrieve JWT token from storage
    chrome.storage.local.get('jwtToken', (result) => {
      const token = result.jwtToken;
      if (!token) {
        hideLoader(submitLoader, submitBtn);
        alert('Not authenticated. Please log in again.');
        showLoginForm();
        return;
      }

      // Prepare form data
      const formData = new FormData();
      formData.append('asin', asin);
      formData.append('remarks', remarksText);
      formData.append('product_link', productLink);
      formData.append('file', selectedFile);

      // Send upload request
      fetch(`${backendUrl}/upload-remarks/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      })
        .then((response) => {
          if (response.ok) {
            return response.json();
          } else if (response.status === 401 || response.status === 403) {
            throw new Error('Session expired. Please log in again.');
          } else {
            return response.text().then((text) => {
              throw new Error(`Failed to upload data: ${text}`);
            });
          }
        })
        .then((data) => {
          alert('Data uploaded successfully.');
          resetForm();
        })
        .catch((error) => {
          console.error('Upload Error:', error);
          alert(error.message);
          if (error.message.includes('Session expired')) {
            chrome.storage.local.remove('jwtToken', () => {
              showLoginForm();
            });
          }
        })
        .finally(() => {
          hideLoader(submitLoader, submitBtn);
        });
    });
  }

  /**
   * Handle user logout.
   */
  function handleLogout() {
    // Confirm Logout Action
    if (!confirm('Are you sure you want to logout?')) {
      return;
    }

    // Show loader and disable logout button
    showLoader(logoutLoader, logoutBtn);

    // Retrieve JWT token from storage
    chrome.storage.local.get('jwtToken', (result) => {
      const token = result.jwtToken;
      if (!token) {
        hideLoader(logoutLoader, logoutBtn);
        alert('You are already logged out.');
        showLoginForm();
        return;
      }

      // Send logout request without Content-Type header and without body
      fetch(`${backendUrl}/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // 'Content-Type': 'application/json', // Removed since no body is sent
        },
        // No body is needed as per the backend endpoint
      })
        .then(async (response) => {
          if (response.ok) {
            const data = await response.json();
            return data;
          } else {
            // Attempt to parse error message from response
            let errorMsg = 'Failed to logout. Please try again.';
            try {
              const errorData = await response.json();
              if (errorData.detail) {
                errorMsg = errorData.detail;
              }
            } catch (e) {
              // Ignore JSON parsing errors
            }
            throw new Error(errorMsg);
          }
        })
        .then((data) => {
          alert(data.message || 'Logged out successfully.');
          // Remove JWT token from storage
          chrome.storage.local.remove('jwtToken', () => {
            hideLoader(logoutLoader, logoutBtn);
            showLoginForm();
            resetForm();
          });
        })
        .catch((error) => {
          hideLoader(logoutLoader, logoutBtn);
          console.error('Logout Error:', error);
          alert(error.message);
        });
    });
  }

  /**
   * Reset the form to its initial state after successful submission or logout.
   */
  function resetForm() {
    selectedFile = null;
    uploadArea.innerHTML = '<p>Drag & Drop or Paste Media Here</p>';
    asinInput.value = '';
    skuIdInput.value = '';
    imageLinkInput.value = '';
    imagePreviewImg.src = '';
    imagePreviewDiv.classList.add('hidden');
    remarksInput.value = '';
    productLinkInput.value = '';
  }

  /**
   * Handle ASIN selection via input event.
   * Updates SKU ID and Image Link fields based on entered ASIN ID.
   */
  function handleASINInput() {
    const enteredASIN = asinInput.value.trim();

    if (!enteredASIN) {
      // If input is empty, clear the fields
      skuIdInput.value = '';
      imageLinkInput.value = '';
      imagePreviewImg.src = '';
      imagePreviewDiv.classList.add('hidden');
      return;
    }

    // Find the entered asin info
    const asinInfo = asinInfoData.find((asin) => asin.asin_id === enteredASIN);

    if (asinInfo) {
      skuIdInput.value = asinInfo.sku_id;
      imageLinkInput.value = asinInfo.image_link;
      imagePreviewImg.src = asinInfo.image_link;
      imagePreviewDiv.classList.remove('hidden');
    } else {
      // If asin_id not found in data, clear the fields
      skuIdInput.value = '';
      imageLinkInput.value = '';
      imagePreviewImg.src = '';
      imagePreviewDiv.classList.add('hidden');
      // Optionally, alert the user
      // alert('Entered ASIN ID not found.');
    }
  }

  // Event Listeners
  loginBtn.addEventListener('click', handleLogin);

  // Initialize the extension
  initialize();
});
