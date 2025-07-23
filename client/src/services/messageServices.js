export const createMessage = (content, type = 'text', fileName = null) => {
  return {
    id: Date.now(),
    sender: 'You',
    content,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    type,
    ...(fileName && { fileName, fileUrl: URL.createObjectURL(fileName) })
  };
};