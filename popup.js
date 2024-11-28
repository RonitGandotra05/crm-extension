document.addEventListener('DOMContentLoaded', function() {
  const uploadArea = document.getElementById('upload-area');
  const asinSelect = document.getElementById('asin-select');
  const remarks = document.getElementById('remarks');
  const productLinkInput = document.getElementById('product-link');
  const submitBtn = document.getElementById('submit-btn');
  let selectedFile = null;

  // Populate ASIN IDs (Replace with actual ASIN IDs)
  const asinIds = ['ASIN1', 'ASIN2', 'ASIN3']; // Add your ASIN IDs here
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

    const reader = new FileReader();
    reader.onload = function(e) {
      const fileData = new Uint8Array(e.target.result);

      // Upload to S3 via HTTP PUT
      const s3BucketUrl = 'https://crm-remarks.s3.ap-south-1.amazonaws.com';
      const uniqueFileName = generateUniqueFileName(selectedFile.name);
      const uploadUrl = s3BucketUrl + '/' + uniqueFileName;

      fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': selectedFile.type,
          'x-amz-acl': 'public-read'
        },
        body: fileData
      })
      .then(response => {
        if (response.ok) {
          const imageLink = uploadUrl;
          saveToDatabase(asin, remarksText, imageLink, productLink);
        } else {
          console.error('Error uploading to S3:', response.statusText);
          alert('Error uploading to S3.');
        }
      })
      .catch(error => {
        console.error('Error uploading to S3:', error);
        alert('Error uploading to S3.');
      });
    };
    reader.readAsArrayBuffer(selectedFile);
  }

  function saveToDatabase(asin, remarksText, imageLink, productLink) {
    // Use a backend API to interact with your PostgreSQL database
    const apiUrl = 'https://your-backend-api.com/save-remarks'; // Replace with your API endpoint

    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        asin: asin,
        remarks: remarksText,
        image_link: imageLink,
        product_link: productLink
      })
    })
    .then(response => {
      if (response.ok) {
        alert('Data saved successfully.');
        // Optionally reset the form
        resetForm();
      } else {
        alert('Failed to save data to the database.');
      }
    })
    .catch(error => {
      console.error('Error saving to database:', error);
      alert('Error saving to database.');
    });
  }

  function resetForm() {
    selectedFile = null;
    uploadArea.innerHTML = '<p>Drag & Drop or Paste Media Here</p>';
    asinSelect.value = '';
    remarks.value = '';
  }

  function generateUniqueFileName(originalName) {
    const timestamp = Date.now();
    const extension = originalName.substring(originalName.lastIndexOf('.'));
    return `${timestamp}_${originalName}${extension}`;
  }
});