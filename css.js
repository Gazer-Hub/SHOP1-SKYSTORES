<style>
  /* Dark and Light mode background & text core rules */
  [data-bs-theme="dark"] body {
    background-color: #121212 !important;
    color: #f8f9fa !important;
  }

  [data-bs-theme="light"] body {
    background-color: #f8f9fa !important;
    color: #212529 !important;
  }

  /* Professional Dark Mode Tweaks for Cards & Tables */
  [data-bs-theme="dark"] .card {
    background-color: #1e1e1e !important;
    color: #f8f9fa !important;
    border-color: #2c2c2c !important;
  }

  [data-bs-theme="dark"] .table {
    color: #f8f9fa !important;
    border-color: #2c2c2c !important;
  }

  [data-bs-theme="dark"] .table-striped > tbody > tr:nth-of-type(odd) {
    background-color: rgba(255, 255, 255, 0.03) !important;
    color: #f8f9fa !important;
  }

  [data-bs-theme="dark"] .form-control, 
  [data-bs-theme="dark"] .form-select {
    background-color: #2b2b2b !important;
    color: #f8f9fa !important;
    border-color: #444 !important;
  }

  [data-bs-theme="dark"] .text-muted {
    color: #adb5bd !important; /* Brighter muted text for readability on dark backgrounds */
  }
</style>
