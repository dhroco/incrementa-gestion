import React, { useState } from 'react';
import RichTextEditor from '../components/RichTextEditor';

const ClauseEditorTest = () => {
  const [formData, setFormData] = useState({
    title: '',
    code: '',
    description: '',
    content: '',
  });

  const handleContentChange = (content) => {
    setFormData(prev => ({
      ...prev,
      content: JSON.stringify(content, null, 2)
    }));
  };

  const handleInputChange = (field) => (e) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '20px', color: 'black' }}>
        Clause Editor Test
      </h1>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Title Input */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px', color: 'black' }}>
            Título de Cláusula
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={handleInputChange('title')}
            placeholder="Ingrese el título de la cláusula"
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #E3E6E8',
              borderRadius: '4px',
              fontSize: '13px',
              outline: 'none'
            }}
          />
        </div>

        {/* Code Input */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px', color: 'black' }}>
            Código
          </label>
          <input
            type="text"
            value={formData.code}
            onChange={handleInputChange('code')}
            placeholder="Ingrese el código de la cláusula"
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #E3E6E8',
              borderRadius: '4px',
              fontSize: '13px',
              outline: 'none'
            }}
          />
        </div>

        {/* Description Input */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px', color: 'black' }}>
            Descripción Resumida
          </label>
          <textarea
            value={formData.description}
            onChange={handleInputChange('description')}
            placeholder="Ingrese una descripción resumida"
            rows={3}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #E3E6E8',
              borderRadius: '4px',
              fontSize: '13px',
              outline: 'none',
              resize: 'vertical'
            }}
          />
        </div>

        {/* Rich Text Editor */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px', color: 'black' }}>
            Contenido de Cláusula
          </label>
          <RichTextEditor
            content={formData.content ? JSON.parse(formData.content || '{}') : ''}
            onChange={handleContentChange}
          />
        </div>

        {/* Debug Section */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px', color: 'black' }}>
            Debug - Contenido Serializado
          </label>
          <textarea
            value={formData.content}
            readOnly
            rows={10}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #E3E6E8',
              borderRadius: '4px',
              fontSize: '12px',
              fontFamily: 'monospace',
              backgroundColor: '#F7F7F7',
              outline: 'none'
            }}
            placeholder="El contenido serializado del editor aparecerá aquí..."
          />
        </div>
      </div>
    </div>
  );
};

export default ClauseEditorTest;
