/**
 * Updates the existing FE Semantic evaluation form without creating a duplicate.
 *
 * 1. Replace PASTE_FORM_ID_HERE with the ID between /d/ and /edit in the Form URL.
 * 2. Run updateFESemanticEvaluationForm.
 */
const FORM_ID = 'PASTE_FORM_ID_HERE';

function updateFESemanticEvaluationForm() {
  if (!FORM_ID || FORM_ID === 'PASTE_FORM_ID_HERE') {
    throw new Error('Add the Google Form ID at the top of this script first.');
  }

  const form = FormApp.openById(FORM_ID);
  form.setTitle('FE Semantic Internal Linking – Newsroom Success Evaluation');
  form.setDescription(
    'Please score each point from 1 to 5. A score of 1 means it is not working well, and a score of 5 means it is working very well. Editorial and Management sections are each weighted to 100%.'
  );

  const updates = {
    'Editorial Relevance & Contextual Fit': {
      title: 'Context, Relevance and Reader Value',
      help: 'Weight: 20%\n\nWhat it asks: Are the suggested links contextual, relevant and meaningful for readers?'
    },
    'Destination Article Quality & Freshness': {
      title: 'Article Quality and Freshness',
      help: 'Weight: 15%\n\nWhat it asks: Is the suggested article accurate, useful, up to date and right for this story?'
    },
    'Anchor Text Quality & In-Article Placement': {
      title: 'Anchor Text and Placement',
      help: 'Weight: 15%\n\nWhat it asks: Are the suggested words clear and natural, and is the link placed in the right part of the story?'
    },
    'Reader Journey & Coverage Depth': {
      title: 'Better Reader Journey',
      help: 'Weight: 15%\n\nWhat it asks: Does the link help readers find useful background, updates, explainers or related reporting?'
    },
    'Editorial Accuracy, Safety & Duplication Control': {
      title: 'Accuracy and Safety',
      help: 'Weight: 15%\n\nWhat it asks: Does the suggestion avoid wrong context, old information, duplicate links and sensitive or risky matches?'
    },
    'Workflow Efficiency & Editor Effort': {
      title: 'Time Saved for Editors',
      help: 'Weight: 10%\n\nWhat it asks: Does the product reduce the time editors spend finding and checking internal links?'
    },
    'Editorial Control, Transparency & Trust': {
      title: 'Editor Control and Trust',
      help: 'Weight: 10%\n\nWhat it asks: Is it clear why the link was suggested, where the data came from, and can editors easily approve, reject or change it?'
    },
    'Reader Engagement & Recirculation Impact': {
      title: 'Reader Engagement',
      help: 'Weight: 20%\n\nWhat it asks: Does it increase useful onward clicks, pages per visit, engaged time and return visits?'
    },
    'Organic Search & Internal Authority Distribution': {
      title: 'Search and Content Discovery',
      help: 'Weight: 20%\n\nWhat it asks: Does it help search engines and readers discover important, evergreen and underused pages?'
    },
    'Editorial Productivity & Cost Efficiency': {
      title: 'Productivity and Cost',
      help: 'Weight: 15%\n\nWhat it asks: Does it reduce manual work and cost while improving the number and quality of internal links?'
    },
    'Newsroom Adoption & Workflow Integration': {
      title: 'Newsroom Use',
      help: 'Weight: 10%\n\nWhat it asks: Are teams using it regularly and adding it to their normal publishing workflow?'
    },
    'Strategic Content Value & Archive Utilisation': {
      title: 'Archive and Strategic Content Value',
      help: 'Weight: 10%\n\nWhat it asks: Does it bring useful archive, evergreen, premium and priority content back to readers?'
    },
    'Revenue, Registration & Subscription Contribution': {
      title: 'Business Value',
      help: 'Weight: 10%\n\nWhat it asks: Does it support registrations, subscriptions or valuable reader journeys without harming trust?'
    },
    'Governance, Risk & Brand Trust': {
      title: 'Safety and Governance',
      help: 'Weight: 10%\n\nWhat it asks: Are suggestions accurate, explainable, trackable and controlled by editors?'
    },
    'Scalability, Reliability & Operational Readiness': {
      title: 'Scale and Reliability',
      help: 'Weight: 5%\n\nWhat it asks: Can it handle newsroom volume with fresh data, stable performance and clear fallback reporting?'
    }
  };

  let changed = 0;
  form.getItems().forEach(function(item) {
    if (item.getType() !== FormApp.ItemType.SCALE) return;
    const scale = item.asScaleItem();
    const update = updates[scale.getTitle()];
    if (!update) return;
    scale.setTitle(update.title).setHelpText(update.help);
    changed += 1;
  });

  Logger.log('Updated questions: ' + changed);
  Logger.log('FORM EDIT URL: ' + form.getEditUrl());
  Logger.log('FORM LIVE URL: ' + form.getPublishedUrl());
}
