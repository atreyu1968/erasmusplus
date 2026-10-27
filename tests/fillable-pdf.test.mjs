import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { makeFillableGuardianPdf } from '../src/guardian-fillable-pdf.mjs';

test('El modelo de autorización se descarga como PDF AcroForm editable y con datos prerrellenados',async ()=>{
 const pdf=await makeFillableGuardianPdf({
  first_name:'Alumno',last_name:'Ficticio',birth_date:'2010-02-16',studies:'Grado Medio de prueba'
 });
 assert.ok(pdf.subarray(0,5).equals(Buffer.from('%PDF-')));
 assert.match(pdf.toString('latin1'),/\/Subtype \/Image/);
 const doc=await PDFDocument.load(pdf);
 assert.equal(doc.getPages().length,2);
 const form=doc.getForm();
 const fields=form.getFields().map(f=>f.getName());
 for(const name of ['menor_nombre','menor_nacimiento','menor_estudios',
   'representante_nombre','representante_documento','representante_telefono',
   'representante_relacion','lugar_fecha'])assert.ok(fields.includes(name),'Falta '+name);
 assert.equal(form.getTextField('menor_nombre').getText(),'Alumno Ficticio');
 assert.equal(form.getTextField('menor_nacimiento').getText(),'16/02/2010');
 assert.equal(form.getRadioGroup('representante_relacion').getSelected(),undefined);
 form.getTextField('representante_nombre').setText('Madre ficticia');
 form.getRadioGroup('representante_relacion').select('Madre');
 const filled=await doc.save();
 const check=await PDFDocument.load(filled);
 assert.equal(check.getForm().getTextField('representante_nombre').getText(),'Madre ficticia');
 assert.equal(check.getForm().getRadioGroup('representante_relacion').getSelected(),'Madre');
});
