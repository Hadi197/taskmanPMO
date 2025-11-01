import React, { useState, useRef } from 'react';
import { Upload, File, X, Download, Trash2 } from 'lucide-react';
import { supabase } from './supabaseClient';

export default function FileUpload({ taskId, onFilesChange, existingFiles = [] }) {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState(existingFiles);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);

  const uploadFile = async (file) => {
    if (!file) return null;

    try {
      setUploading(true);
      setError('');
      setSuccess('');

      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/zip',
        'application/x-rar-compressed'
      ];

      if (!allowedTypes.includes(file.type)) {
        throw new Error(`File type ${file.type} is not allowed. Please upload PDF, DOC, images, Excel, PPT, or ZIP files.`);
      }

      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${taskId}/${Date.now()}.${fileExt}`;

      console.log('Uploading file:', fileName);

      // Upload file to Supabase storage
      const { data, error } = await supabase.storage
        .from('task-documents')
        .upload(fileName, file);

      if (error) {
        console.error('Supabase upload error:', error);
        throw new Error(`Upload failed: ${error.message}`);
      }

      console.log('Upload successful:', data);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('task-documents')
        .getPublicUrl(fileName);

      const fileData = {
        id: Date.now().toString(),
        name: file.name,
        size: file.size,
        type: file.type,
        url: publicUrl,
        path: fileName,
        uploadedAt: new Date().toISOString()
      };

      setSuccess(`File "${file.name}" uploaded successfully!`);
      setTimeout(() => setSuccess(''), 3000); // Clear success message after 3 seconds

      return fileData;
    } catch (error) {
      console.error('Error uploading file:', error);
      const errorMessage = error.message || 'Failed to upload file. Please try again.';
      setError(errorMessage);
      alert(errorMessage); // Keep alert as backup
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (event) => {
    const selectedFiles = Array.from(event.target.files);

    if (selectedFiles.length === 0) return;

    setError('');

    for (const file of selectedFiles) {
      console.log('Processing file:', file.name, 'Size:', file.size, 'Type:', file.type);

      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        const errorMsg = `File ${file.name} is too large. Maximum size is 10MB.`;
        setError(errorMsg);
        alert(errorMsg);
        continue;
      }

      const uploadedFile = await uploadFile(file);
      if (uploadedFile) {
        const newFiles = [...files, uploadedFile];
        setFiles(newFiles);
        onFilesChange(newFiles);
        console.log('File uploaded successfully:', uploadedFile.name);
      } else {
        console.log('File upload failed:', file.name);
      }
    }

    // Reset input
    event.target.value = '';
  };

  const deleteFile = async (fileToDelete) => {
    try {
      // Delete from storage
      const { error } = await supabase.storage
        .from('task-documents')
        .remove([fileToDelete.path]);

      if (error) throw error;

      // Remove from local state
      const newFiles = files.filter(file => file.id !== fileToDelete.id);
      setFiles(newFiles);
      onFilesChange(newFiles);
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Failed to delete file. Please try again.');
    }
  };

  const downloadFile = (file) => {
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Attachments
        </label>

        {/* Error Message */}
        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <X className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setError('')}
                  className="inline-flex rounded-md bg-red-50 p-1.5 text-red-500 hover:bg-red-100"
                >
                  <span className="sr-only">Dismiss</span>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <Upload className="h-5 w-5 text-green-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-800">{success}</p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setSuccess('')}
                  className="inline-flex rounded-md bg-green-50 p-1.5 text-green-500 hover:bg-green-100"
                >
                  <span className="sr-only">Dismiss</span>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upload Button */}
        <div className="flex items-center space-x-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.xlsx,.xls,.ppt,.pptx,.zip,.rar"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? 'Uploading...' : 'Upload Files'}
          </button>
          <span className="text-xs text-gray-500">
            Max 10MB per file. Supported: PDF, DOC, Images, Excel, PPT, ZIP
          </span>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Uploaded Files</h4>
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
              >
                <div className="flex items-center space-x-3">
                  <File className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate max-w-xs">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => downloadFile(file)}
                    className="text-indigo-600 hover:text-indigo-900 p-1"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteFile(file)}
                    className="text-red-600 hover:text-red-900 p-1"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}