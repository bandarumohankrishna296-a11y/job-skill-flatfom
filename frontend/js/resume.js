// js/resume.js
// Resume upload, resume summary rendering and the "review skills" editor.
(function () {
  'use strict';

  let onUploadedCallback = null;
  let onDeletedCallback = null;
  let currentResume = null;

  function render(resume) {
    currentResume = resume || null;
    const hasResume = Boolean(resume && resume.id);

    document.querySelectorAll('[data-resume-empty]').forEach((element) => {
      element.hidden = hasResume;
    });
    document.querySelectorAll('[data-resume-details]').forEach((element) => {
      element.hidden = !hasResume;
    });

    document.querySelectorAll('[data-resume-filename]').forEach((element) => {
      element.textContent = hasResume ? resume.originalName : 'No resume uploaded';
    });
    document.querySelectorAll('[data-resume-meta]').forEach((element) => {
      element.textContent = hasResume
        ? `${App.formatFileSize(resume.size)} • Uploaded ${App.formatDate(resume.uploadedAt)}`
        : 'Upload a PDF or DOCX file (maximum 5 MB).';
    });
    document.querySelectorAll('[data-resume-status-pill]').forEach((element) => {
      element.className = `badge ${hasResume ? 'status-accepted' : 'status-pending'}`;
      element.textContent = hasResume ? 'Resume uploaded' : 'Resume missing';
    });
    document.querySelectorAll('[data-extracted-skills]').forEach((element) => {
      element.innerHTML = App.skillChips(hasResume ? resume.extractedSkills : [], 'extracted');
    });
    document.querySelectorAll('[data-manual-skills]').forEach((element) => {
      element.innerHTML = App.skillChips(hasResume ? resume.manualSkills : [], 'manual');
    });
    document.querySelectorAll('[data-all-skills]').forEach((element) => {
      element.innerHTML = App.skillChips(hasResume ? resume.skills : [], 'default');
    });
    document.querySelectorAll('[data-resume-download]').forEach((button) => {
      button.hidden = !hasResume;
      if (hasResume) {
        button.dataset.downloadUrl = resume.downloadUrl;
        button.dataset.filename = resume.originalName;
      }
    });
    document.querySelectorAll('[data-resume-delete]').forEach((button) => {
      button.hidden = !hasResume;
      if (hasResume) button.dataset.resumeId = resume.id;
    });
    document.querySelectorAll('[data-edit-skills]').forEach((button) => {
      button.disabled = !hasResume;
    });

    return hasResume;
  }

  async function refresh() {
    const response = await App.api('/resumes/my-resume');
    render(response.resume);
    return response;
  }

  async function uploadFile(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx'].includes(extension)) {
      App.showToast('Only PDF and DOCX resumes are allowed.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      App.showToast('Resume is too large. Maximum size is 5 MB.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('resume', file);
    const dropzone = document.querySelector('[data-resume-dropzone]');

    if (dropzone) {
      dropzone.classList.add('uploading');
      const label = dropzone.querySelector('[data-dropzone-label]');
      if (label) label.textContent = 'Reading your resume and extracting skills...';
    }

    try {
      const response = await App.api('/resumes/upload', {
        method: 'POST',
        body: formData,
      });
      render(response.resume);
      App.showToast(response.message, 'success', 'Resume uploaded');
      if (onUploadedCallback) await onUploadedCallback(response);
    } catch (error) {
      App.showToast(error.message, 'error', 'Upload failed');
    } finally {
      if (dropzone) {
        dropzone.classList.remove('uploading');
        const label = dropzone.querySelector('[data-dropzone-label]');
        if (label) label.textContent = 'Click to upload or drag a PDF/DOCX file here';
      }
    }
  }

  function bindUploadControls(options = {}) {
    onUploadedCallback = options.onUploaded || null;
    onDeletedCallback = options.onDeleted || null;

    const input = document.querySelector('[data-resume-input]');
    const dropzone = document.querySelector('[data-resume-dropzone]');
    if (!input) return;

    document.querySelectorAll('[data-resume-upload]').forEach((button) => {
      button.addEventListener('click', () => input.click());
    });

    input.addEventListener('change', () => {
      if (input.files && input.files[0]) uploadFile(input.files[0]);
      input.value = '';
    });

    if (dropzone) {
      dropzone.addEventListener('click', (event) => {
        if (event.target.closest('[data-resume-upload]')) return;
        input.click();
      });
      dropzone.addEventListener('dragover', (event) => {
        event.preventDefault();
        dropzone.classList.add('dragover');
      });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
      dropzone.addEventListener('drop', (event) => {
        event.preventDefault();
        dropzone.classList.remove('dragover');
        if (event.dataTransfer.files && event.dataTransfer.files[0]) {
          uploadFile(event.dataTransfer.files[0]);
        }
      });
    }
  }

  function closeDynamicModal(overlay) {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 180);
    if (!document.querySelector('.modal-overlay.open')) document.body.classList.remove('modal-open');
  }

  async function openSkillsEditor() {
    let resume = currentResume;
    if (!resume) {
      try {
        const response = await App.api('/resumes/my-resume');
        resume = response.resume;
      } catch (error) {
        App.showToast(error.message, 'error');
        return;
      }
    }

    if (!resume) {
      App.showToast('Upload a resume before editing your skills.', 'warning');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal modal-medium" role="dialog" aria-modal="true" aria-labelledby="skills-modal-title">
        <div class="modal-header">
          <div>
            <h2 id="skills-modal-title">Review your skills</h2>
            <p>Keep both lists accurate because they are used for job matching.</p>
          </div>
          <button type="button" class="icon-button" data-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <form id="skills-form">
          <div class="modal-body">
            <div class="form-alert" id="skills-alert" hidden></div>
            <div class="form-group">
              <label for="extracted-skills-input">Extracted from resume</label>
              <textarea id="extracted-skills-input" class="textarea" rows="3" placeholder="Python, React, SQL">${App.escapeHtml((resume.extractedSkills || []).join(', '))}</textarea>
              <small class="field-help">Remove anything the extractor detected incorrectly. Separate skills with commas.</small>
            </div>
            <div class="form-group">
              <label for="manual-skills-input">Manually added skills</label>
              <textarea id="manual-skills-input" class="textarea" rows="3" placeholder="Docker, Communication">${App.escapeHtml((resume.manualSkills || []).join(', '))}</textarea>
              <small class="field-help">These skills are clearly marked as manually added and are kept when you upload a new resume.</small>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-light" data-close>Cancel</button>
            <button type="submit" class="btn btn-primary"><i class="fa-solid fa-floppy-disk"></i> Save skills</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => overlay.classList.add('open'));

    const close = () => closeDynamicModal(overlay);
    overlay.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', close));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });

    const form = overlay.querySelector('#skills-form');
    const alertBox = overlay.querySelector('#skills-alert');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submitButton = form.querySelector('button[type="submit"]');
      App.setButtonLoading(submitButton, true, 'Saving...');

      try {
        const response = await App.api('/resumes/skills', {
          method: 'PATCH',
          body: {
            extractedSkills: App.parseSkillList(overlay.querySelector('#extracted-skills-input').value),
            manualSkills: App.parseSkillList(overlay.querySelector('#manual-skills-input').value),
          },
        });
        currentResume = {
          ...currentResume,
          extractedSkills: response.extractedSkills,
          manualSkills: response.manualSkills,
          skills: response.skills,
        };
        render(currentResume);
        App.showToast(response.message, 'success');
        close();
        document.dispatchEvent(new CustomEvent('resume:skills-updated', { detail: response }));
      } catch (error) {
        alertBox.hidden = false;
        alertBox.className = 'form-alert form-alert-error';
        alertBox.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i><span>${App.escapeHtml(error.message)}</span>`;
        App.setButtonLoading(submitButton, false);
      }
    });
  }

  // One delegated click handler covers buttons rendered at any time.
  document.addEventListener('click', async (event) => {
    const downloadButton = event.target.closest('[data-resume-download]');
    if (downloadButton) {
      event.preventDefault();
      if (!downloadButton.dataset.downloadUrl) {
        App.showToast('No resume is available to download.', 'warning');
        return;
      }
      try {
        await App.downloadFile(downloadButton.dataset.downloadUrl, downloadButton.dataset.filename || 'resume.pdf');
      } catch (error) {
        App.showToast(error.message, 'error');
      }
      return;
    }

    const editButton = event.target.closest('[data-edit-skills]');
    if (editButton) {
      event.preventDefault();
      await openSkillsEditor();
      return;
    }

    const deleteButton = event.target.closest('[data-resume-delete]');
    if (deleteButton) {
      event.preventDefault();
      const confirmed = await App.confirmAction({
        title: 'Delete resume?',
        message: 'Your resume and skill lists will be removed. Existing applications will keep their saved match score.',
        confirmText: 'Delete resume',
      });
      if (!confirmed) return;
      try {
        await App.api(`/resumes/${deleteButton.dataset.resumeId}`, { method: 'DELETE' });
        render(null);
        App.showToast('Resume deleted successfully.', 'success');
        if (onDeletedCallback) await onDeletedCallback();
      } catch (error) {
        App.showToast(error.message, 'error');
      }
    }
  });

  window.ResumeUI = {
    render,
    refresh,
    bindUploadControls,
    openSkillsEditor,
  };
})();
